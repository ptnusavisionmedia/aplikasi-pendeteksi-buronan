"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Plus, Upload, ScanFace, X } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { Field, Input, PrimaryButton, GhostButton, ErrorText, Badge } from "@/components/form";
import type { CctvFeed, DetectionEvent } from "@/lib/types";

export default function CctvPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === "ADMIN" || user?.role === "APARAT" || user?.role === "KEAMANAN_SWASTA";
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nama: "", lokasi: "", urlStream: "", wilayah: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<{ matched: boolean; candidates: { buronanId: string; confidence: number }[] } | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const { data: feeds } = useQuery({
    queryKey: ["cctv-feeds"],
    queryFn: async () => (await apiClient.get<CctvFeed[]>("/cctv-feeds")).data,
  });

  const { data: detections } = useQuery({
    queryKey: ["detections"],
    queryFn: async () => (await apiClient.get<DetectionEvent[]>("/detections")).data,
  });

  async function onCreateFeed(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiClient.post("/cctv-feeds", form);
      setForm({ nama: "", lokasi: "", urlStream: "", wilayah: "" });
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["cctv-feeds"] });
    } catch (err) {
      setError(apiErrorMessage(err, "Gagal menambahkan feed CCTV"));
    } finally {
      setLoading(false);
    }
  }

  async function toggleFeedStatus(feed: CctvFeed) {
    const nextStatus = feed.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await apiClient.patch(`/cctv-feeds/${feed.id}`, { status: nextStatus });
    queryClient.invalidateQueries({ queryKey: ["cctv-feeds"] });
  }

  async function onManualCheck(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCheckError(null);
    setChecking(true);
    setCheckResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await apiClient.post("/detections/upload-check", formData, {
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
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight">CCTV &amp; Deteksi</h1>
            <p className="text-muted text-[13px] mt-1">{feeds?.length ?? 0} feed terdaftar</p>
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onManualCheck} />
            <GhostButton type="button" onClick={() => fileRef.current?.click()} disabled={checking}>
              <Upload className="w-4 h-4" />
              {checking ? "Memeriksa..." : "Periksa Manual"}
            </GhostButton>
            {canManage && (
              <PrimaryButton type="button" onClick={() => setShowForm((v) => !v)}>
                <Plus className="w-4 h-4" /> Tambah Feed
              </PrimaryButton>
            )}
          </div>
        </div>

        <ErrorText>{checkError}</ErrorText>
        {checkResult && (
          <div className="bento-cell mb-4 flex items-start justify-between gap-4">
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

        {showForm && canManage && (
          <form onSubmit={onCreateFeed} className="bento-cell grid grid-cols-2 gap-4 mb-4">
            <ErrorText>{error}</ErrorText>
            <Field label="Nama kamera">
              <Input required value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
            </Field>
            <Field label="Lokasi">
              <Input required value={form.lokasi} onChange={(e) => setForm({ ...form, lokasi: e.target.value })} />
            </Field>
            <Field label="URL Stream (RTSP)">
              <Input required value={form.urlStream} onChange={(e) => setForm({ ...form, urlStream: e.target.value })} placeholder="rtsp://..." />
            </Field>
            <Field label="Wilayah">
              <Input required value={form.wilayah} onChange={(e) => setForm({ ...form, wilayah: e.target.value })} />
            </Field>
            <div className="col-span-2">
              <PrimaryButton type="submit" disabled={loading}>
                {loading ? "Menyimpan..." : "Simpan Feed"}
              </PrimaryButton>
            </div>
          </form>
        )}

        <div className="grid grid-cols-3 gap-4">
          {feeds?.map((feed) => (
            <div key={feed.id} className="bento-cell flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Camera className="w-[18px] h-[18px] text-ink" />
                <Badge tone={feed.status === "ACTIVE" ? "primary" : "muted"}>{feed.status}</Badge>
              </div>
              <div className="font-bold text-[14px]">{feed.nama}</div>
              <div className="text-[12px] text-muted">{feed.lokasi} &middot; {feed.wilayah}</div>
              {canManage && (
                <button onClick={() => toggleFeedStatus(feed)} className="text-[12px] font-semibold text-primary hover:underline text-left">
                  {feed.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                </button>
              )}
            </div>
          ))}
          {feeds?.length === 0 && <p className="text-[12.5px] text-muted col-span-3">Belum ada feed CCTV terdaftar.</p>}
        </div>
      </div>

      <div>
        <h2 className="font-bold text-[16px] mb-3">Riwayat Deteksi</h2>
        <div className="flex flex-col gap-2">
          {detections?.map((d) => (
            <Link key={d.id} href={`/cctv/${d.id}`} className="bento-cell flex items-center gap-3 hover:border-primary transition-colors">
              <div className="w-9 h-9 rounded-lg bg-canvas flex items-center justify-center text-muted">
                <ScanFace className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold truncate">
                  {d.buronan?.nama ?? "Tidak dikenali"} &middot; {d.cctvFeed?.lokasi ?? "Upload manual"}
                </div>
                <div className="text-[11.5px] text-muted">{new Date(d.detectedAt).toLocaleString("id-ID")}</div>
              </div>
              <Badge tone={d.status === "CONFIRMED" ? "coral" : d.status === "LOW_CONFIDENCE" ? "amber" : "muted"}>{d.status}</Badge>
              <span className="text-[11px] font-bold tabular">{Math.round(d.confidenceScore * 100)}%</span>
            </Link>
          ))}
          {detections?.length === 0 && <p className="text-[12.5px] text-muted">Belum ada riwayat deteksi.</p>}
        </div>
      </div>
    </div>
  );
}
