"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { Field, Input, PrimaryButton, ErrorText, SuccessText } from "@/components/form";

interface SystemSettings {
  cctvAutoCheckIntervalSeconds: number;
  liveDetectionPollIntervalMs: number;
  detectionReportThreshold: number;
  detectionMatchThreshold: number;
}

export default function PengaturanPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "ADMIN";

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await apiClient.get<SystemSettings>("/settings")).data,
  });

  const [form, setForm] = useState<SystemSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings, form]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const { data } = await apiClient.patch<SystemSettings>("/settings", form);
      setForm(data);
      queryClient.setQueryData(["settings"], data);
      setSuccess(true);
    } catch (err) {
      setError(apiErrorMessage(err, "Gagal menyimpan pengaturan"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-6">
        <div className="icon-badge bg-canvas">
          <Settings2 className="text-ink w-[18px] h-[18px]" />
        </div>
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Pengaturan</h1>
          <p className="text-muted text-[13px] mt-1">Konfigurasi operasional dashboard & mesin deteksi</p>
        </div>
      </div>

      {!form ? (
        <p className="text-[13px] text-muted">Memuat pengaturan...</p>
      ) : (
        <form onSubmit={onSubmit} className="bento-cell max-w-xl flex flex-col gap-5">
          <div>
            <h2 className="font-bold text-[14px] mb-1">CCTV & Mode Fokus</h2>
            <p className="text-[12px] text-muted mb-3">Seberapa sering dashboard memeriksa status kamera dan memperbarui kotak deteksi.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Interval cek koneksi otomatis (detik)">
                <Input
                  type="number"
                  min={10}
                  max={300}
                  disabled={!isAdmin}
                  value={form.cctvAutoCheckIntervalSeconds}
                  onChange={(e) => setForm({ ...form, cctvAutoCheckIntervalSeconds: Number(e.target.value) })}
                />
              </Field>
              <Field label="Interval refresh Mode Fokus (ms)">
                <Input
                  type="number"
                  min={300}
                  max={5000}
                  step={100}
                  disabled={!isAdmin}
                  value={form.liveDetectionPollIntervalMs}
                  onChange={(e) => setForm({ ...form, liveDetectionPollIntervalMs: Number(e.target.value) })}
                />
              </Field>
            </div>
          </div>

          <div>
            <h2 className="font-bold text-[14px] mb-1">Ambang Batas Deteksi</h2>
            <p className="text-[12px] text-muted mb-3">
              Diterapkan ke mesin deteksi dalam ~15 detik tanpa perlu restart. Kecocokan ≥ ambang &quot;terkonfirmasi&quot; otomatis
              tersimpan sebagai bukti; di antara kedua ambang ini hanya tercatat sebagai kemiripan rendah/menunggu konfirmasi.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ambang laporkan (0-1)">
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  disabled={!isAdmin}
                  value={form.detectionReportThreshold}
                  onChange={(e) => setForm({ ...form, detectionReportThreshold: Number(e.target.value) })}
                />
              </Field>
              <Field label="Ambang terkonfirmasi (0-1)">
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  disabled={!isAdmin}
                  value={form.detectionMatchThreshold}
                  onChange={(e) => setForm({ ...form, detectionMatchThreshold: Number(e.target.value) })}
                />
              </Field>
            </div>
          </div>

          {!isAdmin && (
            <p className="text-[12px] text-muted bg-canvas rounded-lg px-3 py-2">
              Hanya akun ADMIN yang dapat mengubah pengaturan ini — Anda bisa melihatnya, tapi tidak menyimpan perubahan.
            </p>
          )}

          <ErrorText>{error}</ErrorText>
          {success && <SuccessText>Pengaturan tersimpan.</SuccessText>}

          {isAdmin && (
            <PrimaryButton type="submit" disabled={saving} className="self-start">
              {saving ? "Menyimpan..." : "Simpan Pengaturan"}
            </PrimaryButton>
          )}
        </form>
      )}
    </div>
  );
}
