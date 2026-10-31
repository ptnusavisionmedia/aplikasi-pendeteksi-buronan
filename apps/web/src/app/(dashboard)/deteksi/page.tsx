"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScanFace, Upload, X } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { PrimaryButton, Badge } from "@/components/form";
import { RetryImage } from "@/components/retry-image";
import type { DetectionEvent } from "@/lib/types";

interface ManualCheckResult {
  matched: boolean;
  candidates: { buronanId: string; confidence: number }[];
}

/** Riwayat deteksi wajah lintas semua kamera, plus pemeriksaan manual lewat upload foto. */
export default function DeteksiPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<ManualCheckResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const { data: detections } = useQuery({
    queryKey: ["detections"],
    queryFn: async () => (await apiClient.get<DetectionEvent[]>("/detections")).data,
  });

  async function onManualCheck(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCheckError(null);
    setCheckResult(null);
    setChecking(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await apiClient.post<ManualCheckResult>("/detections/upload-check", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setCheckResult(data);
      queryClient.invalidateQueries({ queryKey: ["detections"] });
    } catch (err) {
      setCheckError(apiErrorMessage(err, "Gagal memeriksa foto"));
    } finally {
      setChecking(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Deteksi</h1>
          <p className="text-muted text-[13px] mt-1">{detections?.length ?? 0} riwayat deteksi</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onManualCheck} />
        <PrimaryButton type="button" onClick={() => fileRef.current?.click()} disabled={checking}>
          <Upload className="w-4 h-4" /> {checking ? "Memeriksa..." : "Periksa Manual"}
        </PrimaryButton>
      </div>

      {checkError && (
        <div className="bento-cell flex items-center justify-between gap-3 mb-4 text-coral bg-coral-soft">
          <span className="text-[13px] font-semibold">{checkError}</span>
          <button onClick={() => setCheckError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {checkResult && (
        <div className="bento-cell flex items-start justify-between gap-4 mb-4">
          <div className="text-[13px]">
            {checkResult.matched ? (
              <>
                <span className="font-bold">Kandidat ditemukan:</span>{" "}
                {checkResult.candidates.map((c) => `${Math.round(c.confidence * 100)}%`).join(", ")}
              </>
            ) : (
              "Tidak ada kecocokan ditemukan."
            )}
          </div>
          <button onClick={() => setCheckResult(null)} className="text-muted hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div>
        <h2 className="font-bold text-[16px] mb-3">Riwayat Deteksi</h2>
        <div className="flex flex-col gap-2">
          {detections?.map((d) => {
            const fotoUtama = d.buronan?.fotos?.find((f) => f.isPrimary) ?? d.buronan?.fotos?.[0];
            return (
            <Link key={d.id} href={`/deteksi/${d.id}`} className="bento-cell flex items-center gap-3 hover:border-primary transition-colors">
              {fotoUtama ? (
                <RetryImage
                  src={fotoUtama.urlFoto}
                  alt={d.buronan?.nama ?? "Buronan"}
                  className="w-9 h-9 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-canvas flex items-center justify-center text-muted shrink-0">
                  <ScanFace className="w-4 h-4" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold truncate">
                  {d.buronan?.nama ?? "Tidak dikenali"} &middot; {d.cctvFeed?.lokasi ?? "Upload manual"}
                </div>
                <div className="text-[11.5px] text-muted">{new Date(d.detectedAt).toLocaleString("id-ID")}</div>
              </div>
              <Badge tone={d.status === "CONFIRMED" ? "coral" : d.status === "LOW_CONFIDENCE" ? "amber" : "muted"}>{d.status}</Badge>
              <span className="text-[11px] font-bold tabular">{Math.round(d.confidenceScore * 100)}%</span>
            </Link>
            );
          })}
          {detections?.length === 0 && <p className="text-[12.5px] text-muted">Belum ada riwayat deteksi.</p>}
        </div>
      </div>
    </div>
  );
}
