"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import clsx from "clsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Maximize2, Pencil, Plus, Upload, ScanFace, Wifi, X } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { Field, Input, Select, PrimaryButton, GhostButton, ErrorText, Badge } from "@/components/form";
import { Modal } from "@/components/modal";
import type { CctvFeed, DetectionEvent } from "@/lib/types";

// Leaflet touches `window` at module load time, so it can't be evaluated during Next.js's
// server render — load it only in the browser, once the form modal actually needs it.
const MapPicker = dynamic(() => import("@/components/map-picker"), {
  ssr: false,
  loading: () => <div className="rounded-xl bg-canvas animate-pulse" style={{ height: 220 }} />,
});

/**
 * Template RTSP per merk kamera. "stream" dipakai untuk men-generate placeholder/urlStream
 * saat merk dipilih — pengguna cukup mengisi {user}/{pass}/{ip} sendiri. Semua merk di bawah
 * sudah ONVIF/RTSP-compatible sehingga langsung didukung oleh detection-engine yang ada
 * (OpenCV VideoCapture generik), tanpa perlu integrasi khusus per vendor.
 */
const CAMERA_PRESETS = [
  {
    id: "tapo-c200",
    label: "TP-Link Tapo C200",
    stream: "rtsp://{user}:{pass}@{ip}:554/stream1",
    help: "Aktifkan \"Camera Account\" di app Tapo (Advanced Settings > Camera Account), lalu pakai kredensial itu (bukan akun TP-Link). stream1 = resolusi penuh, stream2 = hemat bandwidth.",
  },
  {
    id: "tapo-lainnya",
    label: "TP-Link Tapo (seri lain: C210/C225/dst)",
    stream: "rtsp://{user}:{pass}@{ip}:554/stream1",
    help: "Pola RTSP sama dengan C200 di sebagian besar seri Tapo.",
  },
  {
    id: "hikvision",
    label: "Hikvision",
    stream: "rtsp://{user}:{pass}@{ip}:554/Streaming/Channels/101",
    help: "Channel 101 = kamera 1 stream utama. Ganti ke 102 untuk sub-stream.",
  },
  {
    id: "dahua",
    label: "Dahua",
    stream: "rtsp://{user}:{pass}@{ip}:554/cam/realmonitor?channel=1&subtype=0",
    help: "subtype=0 stream utama, subtype=1 sub-stream hemat bandwidth.",
  },
  {
    id: "ezviz",
    label: "Ezviz",
    stream: "rtsp://{user}:{pass}@{ip}:554/h264/ch1/main/av_stream",
    help: "Aktifkan akses RTSP di app EZVIZ (Device Settings > Advanced > Local RTSP).",
  },
  {
    id: "imou",
    label: "Imou",
    stream: "rtsp://{user}:{pass}@{ip}:554/cam/realmonitor?channel=1&subtype=0",
    help: "Imou berbasis platform Dahua, pola URL RTSP sama.",
  },
  {
    id: "xiaomi",
    label: "Xiaomi / Mi Home",
    stream: "rtsp://{user}:{pass}@{ip}:8554/live/ch00_0",
    help: "Butuh firmware custom (mis. Xiaomi Hack) agar RTSP aktif — firmware resmi menutup akses RTSP.",
  },
  {
    id: "onvif",
    label: "Generik ONVIF / RTSP lain",
    stream: "rtsp://{user}:{pass}@{ip}:554/",
    help: "Untuk merk lain yang mendukung ONVIF/RTSP standar — cek manual kamera untuk path stream yang tepat.",
  },
  {
    id: "manual",
    label: "Isi URL manual",
    stream: "",
    help: "Masukkan URL RTSP/HTTP stream sepenuhnya sendiri.",
  },
] as const;

interface FeedCheckResult {
  ok: boolean;
  width?: number;
  height?: number;
  fps?: number;
  error?: string;
  snapshotBase64?: string;
}

export default function CctvPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === "ADMIN" || user?.role === "APARAT" || user?.role === "KEAMANAN_SWASTA";
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingFeed, setEditingFeed] = useState<CctvFeed | null>(null);
  const [preset, setPreset] = useState<string>(CAMERA_PRESETS[0].id);
  const [form, setForm] = useState({
    nama: "",
    lokasi: "",
    urlStream: CAMERA_PRESETS[0].stream as string,
    wilayah: "",
    lat: null as number | null,
    lng: null as number | null,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<{ matched: boolean; candidates: { buronanId: string; confidence: number }[] } | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [feedChecks, setFeedChecks] = useState<Record<string, { loading: boolean; result?: FeedCheckResult; error?: string }>>({});

  const { data: feeds } = useQuery({
    queryKey: ["cctv-feeds"],
    queryFn: async () => (await apiClient.get<CctvFeed[]>("/cctv-feeds")).data,
  });

  const { data: detections } = useQuery({
    queryKey: ["detections"],
    queryFn: async () => (await apiClient.get<DetectionEvent[]>("/detections")).data,
  });

  async function onSubmitFeed(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = {
        nama: form.nama,
        lokasi: form.lokasi,
        wilayah: form.wilayah,
        urlStream: form.urlStream,
        ...(form.lat != null && form.lng != null ? { lat: form.lat, lng: form.lng } : {}),
      };
      if (editingFeed) {
        await apiClient.patch(`/cctv-feeds/${editingFeed.id}`, payload);
      } else {
        await apiClient.post("/cctv-feeds", payload);
      }
      closeForm();
      queryClient.invalidateQueries({ queryKey: ["cctv-feeds"] });
    } catch (err) {
      setError(apiErrorMessage(err, editingFeed ? "Gagal menyimpan perubahan feed" : "Gagal menambahkan feed CCTV"));
    } finally {
      setLoading(false);
    }
  }

  function openCreateForm() {
    setEditingFeed(null);
    setForm({ nama: "", lokasi: "", urlStream: CAMERA_PRESETS[0].stream, wilayah: "", lat: null, lng: null });
    setPreset(CAMERA_PRESETS[0].id);
    setShowForm(true);
  }

  function openEditForm(feed: CctvFeed) {
    setEditingFeed(feed);
    setForm({
      nama: feed.nama,
      lokasi: feed.lokasi,
      urlStream: feed.urlStream,
      wilayah: feed.wilayah,
      lat: feed.lat ?? null,
      lng: feed.lng ?? null,
    });
    setPreset("manual");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingFeed(null);
    setError(null);
    setForm({ nama: "", lokasi: "", urlStream: CAMERA_PRESETS[0].stream, wilayah: "", lat: null, lng: null });
    setPreset(CAMERA_PRESETS[0].id);
  }

  async function toggleFeedStatus(feed: CctvFeed) {
    const nextStatus = feed.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await apiClient.patch(`/cctv-feeds/${feed.id}`, { status: nextStatus });
    queryClient.invalidateQueries({ queryKey: ["cctv-feeds"] });
  }

  async function onCheckFeed(feedId: string) {
    setFeedChecks((s) => ({ ...s, [feedId]: { loading: true } }));
    try {
      const { data } = await apiClient.post<FeedCheckResult>(`/cctv-feeds/${feedId}/check`);
      setFeedChecks((s) => ({ ...s, [feedId]: { loading: false, result: data } }));
    } catch (err) {
      setFeedChecks((s) => ({ ...s, [feedId]: { loading: false, error: apiErrorMessage(err, "Gagal cek koneksi") } }));
    }
  }

  // Cek koneksi tiap feed otomatis begitu daftar feed dimuat, lalu diulang tiap 30 detik, supaya
  // status "Terhubung"/"Gagal terhubung" langsung terlihat tanpa pengguna klik "Cek Koneksi" manual.
  useEffect(() => {
    if (!feeds || feeds.length === 0) return;
    feeds.forEach((feed) => onCheckFeed(feed.id));
    const interval = setInterval(() => {
      feeds.forEach((feed) => onCheckFeed(feed.id));
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feeds]);

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
              <PrimaryButton type="button" onClick={openCreateForm}>
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
          <Modal
            title={editingFeed ? `Edit Feed — ${editingFeed.nama}` : "Tambah Feed CCTV"}
            description={
              editingFeed
                ? "Ubah konfigurasi kamera ini. Menyimpan perubahan URL stream akan otomatis memulai ulang koneksi jika feed sedang aktif."
                : "Satu kamera, satu feed. Bisa diuji lewat “Cek Koneksi” setelah disimpan."
            }
            onClose={closeForm}
          >
            <form onSubmit={onSubmitFeed} className="flex flex-col gap-5">
              <ErrorText>{error}</ErrorText>

              <div className="flex flex-col gap-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Identitas</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Nama kamera">
                    <Input
                      autoFocus
                      required
                      value={form.nama}
                      onChange={(e) => setForm({ ...form, nama: e.target.value })}
                      placeholder="mis. Gerbang Depan"
                    />
                  </Field>
                  <Field label="Lokasi">
                    <Input
                      required
                      value={form.lokasi}
                      onChange={(e) => setForm({ ...form, lokasi: e.target.value })}
                      placeholder="mis. Blok M Plaza"
                    />
                  </Field>
                </div>
                <Field label="Wilayah">
                  <Input
                    required
                    value={form.wilayah}
                    onChange={(e) => setForm({ ...form, wilayah: e.target.value })}
                    placeholder="mis. Jakarta Selatan"
                  />
                </Field>
                <Field label="Titik lokasi di peta">
                  <MapPicker
                    lat={form.lat}
                    lng={form.lng}
                    onChange={(lat, lng) => setForm((f) => ({ ...f, lat, lng }))}
                  />
                </Field>
              </div>

              <div className="h-px bg-line" />

              <div className="flex flex-col gap-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Koneksi stream</p>
                <Field label="Merk / tipe kamera">
                  <Select
                    value={preset}
                    onChange={(e) => {
                      const next = e.target.value;
                      setPreset(next);
                      const tmpl = CAMERA_PRESETS.find((p) => p.id === next)?.stream ?? "";
                      setForm((f) => ({ ...f, urlStream: tmpl }));
                    }}
                  >
                    {CAMERA_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="URL Stream (RTSP/ONVIF)">
                  <Input
                    required
                    value={form.urlStream}
                    onChange={(e) => setForm({ ...form, urlStream: e.target.value })}
                    placeholder="rtsp://..."
                    className="font-mono text-[12.5px]"
                  />
                </Field>
                <p className="text-[12px] text-muted bg-canvas rounded-xl px-3 py-2.5">
                  {CAMERA_PRESETS.find((p) => p.id === preset)?.help} Ganti <code>{"{user}"}</code>, <code>{"{pass}"}</code> dan{" "}
                  <code>{"{ip}"}</code> dengan kredensial &amp; IP kamera Anda.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <GhostButton type="button" onClick={closeForm} disabled={loading}>
                  Batal
                </GhostButton>
                <PrimaryButton type="submit" disabled={loading}>
                  {loading ? "Menyimpan..." : editingFeed ? "Simpan Perubahan" : "Simpan Feed"}
                </PrimaryButton>
              </div>
            </form>
          </Modal>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {feeds?.map((feed) => {
            const check = feedChecks[feed.id];
            return (
              <div key={feed.id} className="bento-cell flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="icon-badge bg-canvas">
                    <Camera className="w-[18px] h-[18px] text-ink" />
                  </div>
                  <Badge tone={feed.status === "ACTIVE" ? "primary" : "muted"}>{feed.status}</Badge>
                </div>
                <div>
                  <div className="font-bold text-[14px] leading-tight">{feed.nama}</div>
                  <div className="text-[12px] text-muted mt-0.5">{feed.lokasi} &middot; {feed.wilayah}</div>
                </div>

                {check?.result?.ok && check.result.snapshotBase64 && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:image/jpeg;base64,${check.result.snapshotBase64}`}
                    alt={`Snapshot ${feed.nama}`}
                    className="rounded-lg border border-line w-full aspect-video object-cover"
                  />
                )}
                {check?.loading && (
                  <div className="text-[11.5px] font-semibold rounded-lg px-2.5 py-2 bg-canvas text-muted flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse" /> Mengecek koneksi...
                  </div>
                )}
                {check && !check.loading && (
                  <div className={clsx(
                    "text-[11.5px] font-semibold rounded-lg px-2.5 py-2 flex items-center gap-1.5",
                    check.result?.ok ? "bg-primary-soft text-primary-ink" : "bg-coral-soft text-coral"
                  )}>
                    <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", check.result?.ok ? "bg-primary" : "bg-coral")} />
                    {check.result?.ok
                      ? `Terhubung${check.result.width ? ` · ${check.result.width}x${check.result.height}` : ""}${check.result.fps ? ` · ${Math.round(check.result.fps)}fps` : ""}`
                      : (check.result?.error ?? check.error ?? "Gagal terhubung")}
                  </div>
                )}

                <div className="flex items-center flex-wrap gap-2 mt-auto pt-2 border-t border-line">
                  <button
                    onClick={() => onCheckFeed(feed.id)}
                    disabled={check?.loading}
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-ink bg-canvas hover:bg-line transition-colors rounded-lg px-2.5 py-1.5 disabled:opacity-50"
                  >
                    <Wifi className="w-3.5 h-3.5" /> {check?.loading ? "Mengecek..." : "Cek Koneksi"}
                  </button>
                  <Link
                    href={`/cctv/live/${feed.id}`}
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-ink bg-canvas hover:bg-line transition-colors rounded-lg px-2.5 py-1.5"
                  >
                    <Maximize2 className="w-3.5 h-3.5" /> Mode Fokus
                  </Link>
                  {canManage && (
                    <button
                      onClick={() => openEditForm(feed)}
                      className="flex items-center gap-1.5 text-[12px] font-semibold text-ink bg-canvas hover:bg-line transition-colors rounded-lg px-2.5 py-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                  {canManage && (
                    <button onClick={() => toggleFeedStatus(feed)} className="text-[12px] font-semibold text-primary hover:underline text-left ml-auto shrink-0">
                      {feed.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
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
