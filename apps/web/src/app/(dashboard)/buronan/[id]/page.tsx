"use client";

import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserSearch, Upload, ScanFace, Trash2, ArrowLeft, X } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { Badge, Select, ErrorText, GhostButton } from "@/components/form";
import { RetryImage } from "@/components/retry-image";
import type { Buronan, BuronanStatus, DetectionEvent } from "@/lib/types";

const STATUS_TONE: Record<BuronanStatus, "coral" | "primary" | "muted"> = {
  DPO_AKTIF: "coral",
  TERTANGKAP: "primary",
  DICABUT: "muted",
};

export default function BuronanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === "ADMIN" || user?.role === "INSTANSI_HUKUM";
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data: buronan } = useQuery({
    queryKey: ["buronan", id],
    queryFn: async () => (await apiClient.get<Buronan & { detectionEvents: DetectionEvent[] }>(`/buronan/${id}`)).data,
  });

  async function updateStatus(status: BuronanStatus) {
    await apiClient.patch(`/buronan/${id}/status`, { status });
    queryClient.invalidateQueries({ queryKey: ["buronan", id] });
  }

  async function onUploadFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("foto", file);
      formData.append("isPrimary", buronan?.fotos?.length ? "false" : "true");
      await apiClient.post(`/buronan/${id}/foto`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      queryClient.invalidateQueries({ queryKey: ["buronan", id] });
    } catch (err) {
      setUploadError(apiErrorMessage(err, "Gagal mengunggah foto"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onDelete() {
    if (!buronan) return;
    if (
      !window.confirm(
        `Hapus data buronan "${buronan.nama}" (Kasus #${buronan.nomorKasus})? Semua foto wajah & pendaftarannya ikut terhapus dan tidak bisa dikembalikan. Riwayat deteksi lama tetap tersimpan sebagai arsip.`
      )
    ) {
      return;
    }
    setDeleteError(null);
    setDeleting(true);
    try {
      await apiClient.delete(`/buronan/${id}`);
      router.push("/buronan");
    } catch (err) {
      setDeleteError(apiErrorMessage(err, "Gagal menghapus data buronan"));
      setDeleting(false);
    }
  }

  if (!buronan) return <p className="text-[13px] text-muted">Memuat data...</p>;

  const primaryFoto = buronan.fotos?.find((f) => f.isPrimary) ?? buronan.fotos?.[0];

  return (
    <div>
      <button
        type="button"
        onClick={() => router.push("/buronan")}
        className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted hover:text-ink transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali ke daftar buronan
      </button>

      <div className="grid grid-cols-3 gap-5">
      <div className="bento-cell flex flex-col gap-4">
        <div className="w-full aspect-square rounded-xl bg-canvas overflow-hidden flex items-center justify-center text-muted">
          {primaryFoto ? (
            <RetryImage src={primaryFoto.urlFoto} alt={buronan.nama} className="w-full h-full object-cover" />
          ) : (
            <UserSearch className="w-10 h-10" />
          )}
        </div>
        <div>
          <h1 className="text-[18px] font-extrabold tracking-tight">{buronan.nama}</h1>
          <p className="text-[12.5px] text-muted">Kasus #{buronan.nomorKasus}</p>
        </div>
        <Badge tone={STATUS_TONE[buronan.status]}>{buronan.status.replace("_", " ")}</Badge>
        <div className="text-[12.5px] text-muted flex flex-col gap-1">
          <div>NIK: {buronan.nik ?? "-"}</div>
          <div>Tingkat ancaman: {buronan.tingkatAncaman}</div>
          <div>Terdaftar: {new Date(buronan.createdAt).toLocaleDateString("id-ID")}</div>
        </div>

        {canManage && (
          <>
            <Select value={buronan.status} onChange={(e) => updateStatus(e.target.value as BuronanStatus)}>
              <option value="DPO_AKTIF">DPO Aktif</option>
              <option value="TERTANGKAP">Tertangkap</option>
              <option value="DICABUT">Dicabut</option>
            </Select>

            <ErrorText>{uploadError}</ErrorText>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onUploadFoto} />
            <GhostButton type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="w-4 h-4" />
              {uploading ? "Mengunggah & mendaftarkan wajah..." : "Tambah Foto Wajah"}
            </GhostButton>

            <div className="h-px bg-line" />
            <ErrorText>{deleteError}</ErrorText>
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="flex items-center justify-center gap-2 text-coral bg-coral-soft text-[13.5px] font-semibold px-4 py-2.5 rounded-xl hover:bg-coral hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? "Menghapus..." : "Hapus Buronan"}
            </button>
          </>
        )}
      </div>

      <div className="bento-cell col-span-2">
        <h2 className="font-bold text-[14px] mb-3">Foto Terdaftar ({buronan.fotos?.length ?? 0})</h2>
        <div className="grid grid-cols-4 gap-3 mb-6">
          {buronan.fotos?.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setLightboxUrl(f.urlFoto)}
              className="aspect-square rounded-xl border border-line overflow-hidden hover:opacity-80 transition-opacity"
            >
              <RetryImage src={f.urlFoto} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
          {(!buronan.fotos || buronan.fotos.length === 0) && (
            <p className="text-[12.5px] text-muted col-span-4">Belum ada foto wajah terdaftar.</p>
          )}
        </div>

        <h2 className="font-bold text-[14px] mb-3">Riwayat Deteksi</h2>
        <div className="flex flex-col gap-2">
          {buronan.detectionEvents?.length === 0 && <p className="text-[12.5px] text-muted">Belum ada deteksi untuk buronan ini.</p>}
          {buronan.detectionEvents?.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-xl bg-canvas px-3 py-2.5">
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-muted">
                <ScanFace className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold">{d.status}</div>
                <div className="text-[11.5px] text-muted">{new Date(d.detectedAt).toLocaleString("id-ID")}</div>
              </div>
              <span className="text-[11px] font-bold text-muted">{Math.round(d.confidenceScore * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
      </div>

      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            aria-label="Tutup, kembali"
            className="absolute top-5 left-5 flex items-center gap-1.5 text-[13px] font-semibold text-white/90 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali
          </button>
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            aria-label="Tutup"
            className="absolute top-5 right-5 text-white/90 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <RetryImage
            src={lightboxUrl}
            alt={buronan.nama}
            className="max-h-[85vh] max-w-[85vw] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
