"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Camera, WifiOff } from "lucide-react";
import { apiClient } from "@/lib/api-client";

type Status = "connecting" | "live" | "error";

/**
 * Continuously-playing live thumbnail for a CCTV card — same MediaMTX HLS relay Mode Fokus uses
 * (see cctv/live/[id]/page.tsx), just muted/unmuted-controls-free and sized for a grid card. Lets
 * an operator monitor every camera from the CCTV list without opening Mode Fokus per feed.
 */
export function LiveFeedVideo({ feedId, mirror, className }: { feedId: string; mirror?: boolean; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("connecting");

  useEffect(() => {
    let hls: Hls | null = null;
    let cancelled = false;
    const video = videoRef.current;

    async function connect() {
      setStatus("connecting");
      try {
        const { data } = await apiClient.post<{ hlsUrl: string }>(`/cctv-feeds/${feedId}/live`);
        if (cancelled || !video) return;

        if (Hls.isSupported()) {
          hls = new Hls({ liveSyncDurationCount: 3 });
          hls.loadSource(data.hlsUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (cancelled) return;
            setStatus("live");
            video.play().catch(() => {});
          });
          hls.on(Hls.Events.ERROR, (_evt, errData) => {
            if (errData.fatal && !cancelled) setStatus("error");
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = data.hlsUrl;
          video.addEventListener("loadedmetadata", () => {
            if (cancelled) return;
            setStatus("live");
            video.play().catch(() => {});
          });
        } else {
          setStatus("error");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    connect();
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [feedId]);

  return (
    <div className={`relative overflow-hidden bg-ink ${className ?? ""}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        loop
        className="w-full h-full object-cover"
        style={mirror ? { transform: "scaleX(-1)" } : undefined}
      />
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
