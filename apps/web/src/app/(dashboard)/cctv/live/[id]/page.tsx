"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Hls from "hls.js";
import { ArrowLeft } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { Badge } from "@/components/form";
import type { CctvFeed } from "@/lib/types";

type Status = "connecting" | "live" | "error";

interface LiveDetection {
  active: boolean;
  bbox?: [number, number, number, number];
  confidence?: number;
  ageSeconds?: number;
}

const STALE_DETECTION_SECONDS = 8; // a couple missed capture ticks (~2s each) — camera loop likely stopped

/** Green <50%, yellow 50-90%, red >=90% — the same cutoff that decides whether apps/api
 * auto-captures the frame into the database (CONFIDENCE_THRESHOLD in detections.ts). */
function tierFor(confidence: number): { color: string; soft: string; label: string } {
  if (confidence >= 0.9) return { color: "var(--color-coral)", soft: "var(--color-coral-soft)", label: "COCOK TINGGI" };
  if (confidence >= 0.5) return { color: "var(--color-amber)", soft: "var(--color-amber-soft)", label: "MIRIP" };
  return { color: "var(--color-safe)", soft: "var(--color-safe-soft)", label: "RENDAH" };
}

/**
 * Mode Fokus: fullscreen live view of one camera. The browser can't play RTSP
 * directly, so apps/api registers a MediaMTX path on open (POST /cctv-feeds/:id/live)
 * that pulls the camera's RTSP source on-demand and republishes it as HLS, which
 * hls.js plays here. See vault/03-Decisions for why (no in-browser RTSP support).
 */
export default function CctvFocusPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [detection, setDetection] = useState<LiveDetection | null>(null);

  const { data: feed } = useQuery({
    queryKey: ["cctv-feeds"],
    queryFn: async () => (await apiClient.get<CctvFeed[]>("/cctv-feeds")).data,
    select: (feeds) => feeds.find((f) => f.id === id),
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") router.push("/cctv");
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router]);

  useEffect(() => {
    let hls: Hls | null = null;
    let cancelled = false;
    const video = videoRef.current;

    async function connect() {
      setStatus("connecting");
      setError(null);
      try {
        const { data } = await apiClient.post<{ hlsUrl: string }>(`/cctv-feeds/${id}/live`);
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
            if (errData.fatal && !cancelled) {
              setStatus("error");
              setError("Gagal memutar live stream — cek koneksi kamera atau coba lagi.");
            }
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
          setError("Browser ini tidak mendukung pemutaran HLS.");
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setError(apiErrorMessage(err, "Gagal menyiapkan live stream"));
        }
      }
    }

    connect();
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [id]);

  useEffect(() => {
    if (status !== "live" || !id) return;
    let cancelled = false;

    async function poll() {
      try {
        const { data } = await apiClient.get<LiveDetection>(`/cctv-feeds/${id}/live-detection`);
        if (cancelled) return;
        const stale = data.active && (data.ageSeconds ?? 0) > STALE_DETECTION_SECONDS;
        setDetection(stale ? { active: false } : data);
      } catch {
        if (!cancelled) setDetection(null);
      }
    }

    poll();
    const interval = setInterval(poll, 1200);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id, status]);

  const tier = detection?.active && detection.confidence !== undefined ? tierFor(detection.confidence) : null;
  const bbox = detection?.active ? detection.bbox : undefined;

  return (
    <div className="fixed inset-0 bg-ink z-50 flex flex-col">
      <div className="flex items-center justify-between px-5 py-4">
        <button
          onClick={() => router.push("/cctv")}
          className="flex items-center gap-2 text-[13.5px] font-semibold text-white bg-white/10 hover:bg-white/20 transition-colors rounded-xl px-3.5 py-2"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke CCTV
        </button>
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-[14px] text-white">{feed?.nama ?? "Memuat..."}</span>
          {feed && <Badge tone={feed.status === "ACTIVE" ? "primary" : "muted"}>{feed.status}</Badge>}
        </div>
        <div className="w-[120px]" />
      </div>

      <div className="flex-1 flex items-center justify-center relative px-4 pb-4">
        <div className="relative inline-block max-w-full max-h-full">
          <video ref={videoRef} controls autoPlay playsInline muted className="block max-w-full max-h-full rounded-xl" />

          {bbox && tier && (
            <div
              className="absolute border-[3px] rounded-md pointer-events-none transition-[left,top,width,height] duration-300"
              style={{
                left: `${bbox[0] * 100}%`,
                top: `${bbox[1] * 100}%`,
                width: `${(bbox[2] - bbox[0]) * 100}%`,
                height: `${(bbox[3] - bbox[1]) * 100}%`,
                borderColor: tier.color,
                boxShadow: `0 0 0 9999px transparent, 0 0 16px 0 ${tier.color}66`,
              }}
            >
              <span
                className="absolute -top-6 left-0 text-[10.5px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
                style={{ background: tier.color, color: "#fff" }}
              >
                {Math.round((detection?.confidence ?? 0) * 100)}% &middot; {tier.label}
              </span>
            </div>
          )}
        </div>

        {status === "connecting" && (
          <div className="absolute inset-0 flex items-center justify-center text-white text-[13.5px]">
            Menghubungkan ke kamera...
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-4 flex items-center justify-center text-center text-white text-[13.5px] bg-ink/90 rounded-xl px-6">
            {error}
          </div>
        )}
      </div>

      {status === "live" && (
        <div className="flex items-center justify-center gap-5 px-5 pb-4 text-[11.5px] font-semibold text-white/70">
          <LegendDot color="var(--color-safe)" label="< 50% — rendah" />
          <LegendDot color="var(--color-amber)" label="50–90% — mirip" />
          <LegendDot color="var(--color-coral)" label="≥ 90% — otomatis tersimpan ke database" />
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
