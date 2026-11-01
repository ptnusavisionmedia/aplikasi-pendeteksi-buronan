"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScanFace, Trash2, Upload, X } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { PrimaryButton, GhostButton, Badge } from "@/components/form";
import { RetryImage } from "@/components/retry-image";
import { SearchBar, Pagination } from "@/components/list-controls";
import { ExportButtons } from "@/components/export-buttons";
import { detectionStatusMeta } from "@/lib/detection-status";
import { useAuthStore } from "@/store/auth-store";
import type { DetectionEvent, PaginatedResult } from "@/lib/types";

interface ManualCheckResult {
  matched: boolean;
  candidates: { buronanId: string; confidence: number }[];
}

const HIGH_CONFIDENCE = 0.7;

/** Riwayat deteksi wajah lintas semua kamera, ditampilkan sebagai card foto + persentase
 * kemiripan, plus pemeriksaan manual lewat upload foto. */
export default function DeteksiPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<ManualCheckResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [clearing, setClearing] = useState(false);

  const { data } = useQuery({
    queryKey: ["detections", "list", { q, page }],
    queryFn: async () =>
      (await apiClient.get<PaginatedResult<DetectionEvent>>("/detections", { params: { q: q || undefined, page, limit: 24 } })).data,
  });
  const detections = data?.items ?? [];

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

  async function onClearData() {
    if (!confirm("Hapus SEMUA riwayat deteksi secara permanen? Tindakan ini tidak dapat dibatalkan.")) return;
    setClearing(true);
    try {
      await apiClient.delete("/detections/clear");
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ["detections"] });
    } catch (err) {
      setCheckError(apiErrorMessage(err, "Gagal menghapus data"));
    } finally {
      setClearing(false);
    }
  }

  const exportRows = detections.map((d) => [
    d.buronan?.nama ?? "Tidak dikenali",
    d.cctvFeed?.lokasi ?? "Upload manual",
    `${Math.round(d.confidenceScore * 100)}%`,
    d.status,
    new Date(d.detectedAt).toLocaleString("id-ID"),
  ]);

  return (
    <div>
      <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Deteksi</h1>
          <p className="text-muted text-[13px] mt-1">{data?.total ?? 0} riwayat deteksi</p>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === "ADMIN" && (
            <GhostButton type="button" onClick={onClearData} disabled={clearing} className="text-coral">
              <Trash2 className="w-4 h-4" /> {clearing ? "Menghapus..." : "Bersihkan Data"}
            </GhostButton>
          )}
          <ExportButtons
            title="Riwayat Deteksi"
            filenameBase="riwayat-deteksi"
            headers={["Nama", "Lokasi", "Kemiripan", "Status", "Waktu"]}
            rows={exportRows}
          />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onManualCheck} />
          <PrimaryButton type="button" onClick={() => fileRef.current?.click()} disabled={checking}>
            <Upload className="w-4 h-4" /> {checking ? "Memeriksa..." : "Periksa Manual"}
          </PrimaryButton>
        </div>
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

      <div className="mb-4">
        <SearchBar value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Cari nama buronan atau kamera..." />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {detections.map((d) => {
          const fotoUtama = d.buronan?.fotos?.find((f) => f.isPrimary) ?? d.buronan?.fotos?.[0];
          const pct = Math.round(d.confidenceScore * 100);
          const isHighConfidence = d.confidenceScore >= HIGH_CONFIDENCE;
          return (
            <Link
              key={d.id}
              href={`/deteksi/${d.id}`}
              className="bento-cell flex flex-col gap-2 p-3 hover:border-primary transition-colors"
            >
              <div className="relative aspect-square rounded-lg overflow-hidden bg-canvas">
                {fotoUtama ? (
                  <RetryImage src={fotoUtama.urlFoto} alt={d.buronan?.nama ?? "Buronan"} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted">
                    <ScanFace className="w-6 h-6" />
                  </div>
                )}
                {isHighConfidence && (
                  <span className="absolute top-1.5 right-1.5 bg-coral text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                    {pct}%
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold truncate">{d.buronan?.nama ?? "Tidak dikenali"}</div>
                <div className="text-[11px] text-muted truncate">{d.cctvFeed?.lokasi ?? "Upload manual"}</div>
              </div>
              <div className="flex items-center justify-between">
                <Badge tone={detectionStatusMeta(d.status).tone}>{detectionStatusMeta(d.status).label}</Badge>
                {!isHighConfidence && <span className="text-[11px] font-bold tabular text-muted">{pct}%</span>}
              </div>
              <div className="text-[10.5px] text-muted">{new Date(d.detectedAt).toLocaleString("id-ID")}</div>
            </Link>
          );
        })}
      </div>
      {detections.length === 0 && <p className="text-[12.5px] text-muted mt-4">Belum ada riwayat deteksi.</p>}

      <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} onPageChange={setPage} />
    </div>
  );
}
