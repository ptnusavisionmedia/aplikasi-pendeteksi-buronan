"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { Field, Input, Select, PrimaryButton, ErrorText } from "@/components/form";

export default function NewBuronanPage() {
  const router = useRouter();
  const [form, setForm] = useState({ nama: "", nik: "", nomorKasus: "", tingkatAncaman: "Sedang" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await apiClient.post("/buronan", {
        nama: form.nama,
        nik: form.nik || undefined,
        nomorKasus: form.nomorKasus,
        tingkatAncaman: form.tingkatAncaman,
      });
      router.push(`/buronan/${data.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, "Gagal menambahkan buronan"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-[22px] font-extrabold tracking-tight mb-1">Tambah Buronan</h1>
      <p className="text-muted text-[13px] mb-6">Data dasar dulu — foto bisa ditambahkan setelah tersimpan.</p>

      <form onSubmit={onSubmit} className="bento-cell flex flex-col gap-4">
        <ErrorText>{error}</ErrorText>
        <Field label="Nama lengkap">
          <Input required value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
        </Field>
        <Field label="NIK (opsional)">
          <Input value={form.nik} onChange={(e) => setForm({ ...form, nik: e.target.value })} />
        </Field>
        <Field label="Nomor kasus">
          <Input required value={form.nomorKasus} onChange={(e) => setForm({ ...form, nomorKasus: e.target.value })} placeholder="contoh: POL-2026-0312" />
        </Field>
        <Field label="Tingkat ancaman">
          <Select value={form.tingkatAncaman} onChange={(e) => setForm({ ...form, tingkatAncaman: e.target.value })}>
            <option value="Tinggi">Tinggi</option>
            <option value="Sedang">Sedang</option>
            <option value="Rendah">Rendah</option>
          </Select>
        </Field>
        <PrimaryButton type="submit" disabled={loading}>
          <UserPlus className="w-4 h-4" />
          {loading ? "Menyimpan..." : "Simpan Buronan"}
        </PrimaryButton>
      </form>
    </div>
  );
}
