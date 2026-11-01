"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Hls from "hls.js";
import { Camera, WifiOff } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { tierFor } from "@/lib/detection-tier";
import { useLiveDetection } from "@/lib/use-live-detection";

type Status = "connecting" | "live" | "error";

/**
 * Continuously-playing live thumbnail for a CCTV card — same MediaMTX HLS relay Mode Fokus uses
 * (see cctv/live/[id]/page.tsx), just muted/unmuted-controls-free and sized for a grid card. Lets
 * an operator monitor every camera from the CCTV list without opening Mode Fokus per feed.
 *
 * `showDetection` additionally overlays the same live bounding-box detection Mode Fokus shows —
 * so an operator can see who's being matched right from the CCTV list, without opening Mode
 * Fokus per camera (the thing this prop exists to avoid).
 */
export function LiveFeedVideo({
  feedId,
  mirror,
  className,
  showDetection = false,
}: {
  feedId: string;
  mirror?: boolean;
  className?: string;
  showDetection?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("connecting");

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () =>
      (
        await apiClient.get<{
          liveDetectionPollIntervalMs: number;
          detectionReportThreshold: number;
          detectionMatchThreshold: number;
        }>("/settings")
      ).data,
    enabled: showDetection,
  });
  const faces = useLiveDetection(feedId, showDetection && status === "live", settings?.liveDetectionPollIntervalMs ?? 1200);
  const reportThreshold = settings?.detectionReportThreshold ?? 0.5;
  const matchThreshold = settings?.detectionMatchThreshold ?? 0.7;

  useEffect(() => {
    let hls: Hls | null = null;
    let pc: RTCPeerConnection | null = null;
    let whepSessionUrl: string | null = null;
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    const video = videoRef.current;

    // Sama seperti Mode Fokus (cctv/live/[id]/page.tsx) — tanpa ini, kartu live di daftar CCTV
    // diam saja setelah koneksi putus di tengah jalan, membuat video terasa "ketinggalan" sampai
    // operator refresh halaman manual.
    const MAX_AUTO_RETRIES = 5;

    function cleanupSession() {
      hls?.destroy();
      hls = null;
      pc?.close();
      pc = null;
      if (whepSessionUrl) {
        fetch(whepSessionUrl, { method: "DELETE" }).catch(() => {});
        whepSessionUrl = null;
      }
    }

    function scheduleReconnect() {
      if (cancelled) return;
      cleanupSession();
      attempt += 1;
      if (attempt > MAX_AUTO_RETRIES) {
        setStatus("error");
        return;
      }
      setStatus("connecting");
      const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
      reconnectTimer = setTimeout(() => {
        if (!cancelled) connect();
      }, delay);
    }

    function playHls(hlsUrl: string) {
      if (!video) return;
      if (Hls.isSupported()) {
        hls = new Hls({ liveSyncDurationCount: 2, maxLiveSyncPlaybackRate: 1.2 });
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (cancelled) return;
          attempt = 0;
          setStatus("live");
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_evt, errData) => {
          if (errData.fatal && !cancelled) scheduleReconnect();
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = hlsUrl;
        video.addEventListener("loadedmetadata", () => {
          if (cancelled) return;
          setStatus("live");
          video.play().catch(() => {});
        });
      } else {
        setStatus("error");
      }
    }

    // Same WHEP-first strategy as Mode Fokus (see cctv/live/[id]/page.tsx) — sub-second
    // glass-to-glass latency instead of HLS's multi-second segment buffering, which is the
    // actual source of the "video terasa delay" complaint on this card. Falls back to HLS on
    // any failure, including a WHEP session that signals OK but never delivers a frame.
    async function playWhep(whepUrl: string): Promise<boolean> {
      if (!video || typeof RTCPeerConnection === "undefined") return false;
      try {
        pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });
        const stream = new MediaStream();
        video.srcObject = stream;
        pc.ontrack = (evt) => stream.addTrack(evt.track);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        if (pc.iceGatheringState !== "complete") {
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(resolve, 3000);
            pc!.addEventListener("icegatheringstatechange", () => {
              if (pc!.iceGatheringState === "complete") {
                clearTimeout(timeout);
                resolve();
              }
            });
          });
        }

        const resp = await fetch(whepUrl, {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: pc.localDescription?.sdp ?? offer.sdp,
        });
        if (!resp.ok) return false;
        whepSessionUrl = resp.headers.get("Location")
          ? new URL(resp.headers.get("Location")!, whepUrl).toString()
          : null;

        const answerSdp = await resp.text();
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
        if (cancelled) return true;
        video.play().catch(() => {});

        const gotFrame = await new Promise<boolean>((resolveFrame) => {
          const onPlaying = () => resolveFrame(true);
          video!.addEventListener("playing", onPlaying, { once: true });
          setTimeout(() => {
            video!.removeEventListener("playing", onPlaying);
            resolveFrame(false);
          }, 5000);
        });

        if (!gotFrame || cancelled) return false;
        attempt = 0;
        setStatus("live");
        pc.addEventListener("connectionstatechange", () => {
          if (!cancelled && (pc?.connectionState === "failed" || pc?.connectionState === "disconnected")) {
            scheduleReconnect();
          }
        });
        return true;
      } catch {
        return false;
      }
    }

    async function connect() {
      setStatus("connecting");
      try {
        const { data } = await apiClient.post<{ hlsUrl: string; whepUrl?: string }>(`/cctv-feeds/${feedId}/live`);
        if (cancelled || !video) return;

        const whepOk = data.whepUrl ? await playWhep(data.whepUrl) : false;
        if (cancelled) return;
        if (!whepOk) {
          pc?.close();
          pc = null;
          video.srcObject = null;
          if (whepSessionUrl) {
            fetch(whepSessionUrl, { method: "DELETE" }).catch(() => {});
            whepSessionUrl = null;
          }
          playHls(data.hlsUrl);
        }
      } catch {
        if (!cancelled) scheduleReconnect();
      }
    }

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      cleanupSession();
    };
  }, [feedId]);

  return (
    <div className={`relative overflow-hidden bg-ink ${className ?? ""}`}>
      {/* Mirrors video + bbox overlay together (same pattern as Mode Fokus) so detection boxes
          stay aligned with the corrected picture when this camera's mirror toggle is on. */}
      <div className="relative w-full h-full" style={mirror ? { transform: "scaleX(-1)" } : undefined}>
        <video ref={videoRef} autoPlay playsInline muted loop className="w-full h-full object-cover" />
        {showDetection &&
          faces.map((face, i) => {
            const tier = tierFor(face.confidence, reportThreshold, matchThreshold);
            return (
              <div
                key={i}
                className="absolute border-2 rounded pointer-events-none"
                style={{
                  left: `${face.bbox[0] * 100}%`,
                  top: `${face.bbox[1] * 100}%`,
                  width: `${(face.bbox[2] - face.bbox[0]) * 100}%`,
                  height: `${(face.bbox[3] - face.bbox[1]) * 100}%`,
                  borderColor: tier.color,
                }}
              >
                <span
                  className="absolute -top-4 left-0 text-[9px] font-bold px-1 py-0.5 rounded whitespace-nowrap leading-none"
                  style={{ background: tier.color, color: "#fff", transform: mirror ? "scaleX(-1)" : undefined }}
                >
                  {Math.round(face.confidence * 100)}%
                </span>
              </div>
            );
          })}
      </div>
      {status === "connecting" && (
        <div className="absolute inset-0 flex items-center justify-center text-white/70 text-[11.5px] font-semibold gap-1.5">
          <Camera className="w-3.5 h-3.5 animate-pulse" /> Menghubungkan...
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center text-white/70 text-[11.5px] font-semibold gap-1.5">
          <WifiOff className="w-3.5 h-3.5" /> Tidak bisa memuat live video
        </div>
      )}
    </div>
  );
}
