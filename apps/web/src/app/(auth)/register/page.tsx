"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { Field, Input, Select, PrimaryButton, ErrorText, SuccessText } from "@/components/form";
import type { Role } from "@/lib/types";

const ROLE_OPTIONS: { value: Exclude<Role, "ADMIN">; label: string }[] = [
  { value: "MASYARAKAT", label: "Masyarakat Umum" },
  { value: "APARAT", label: "Aparat / Kepolisian" },
  { value: "KEAMANAN_SWASTA", label: "Petugas Keamanan Swasta" },
  { value: "INSTANSI_HUKUM", label: "Instansi Hukum" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ nama: "", email: "", password: "", role: "MASYARAKAT", wilayahScope: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const needsWilayah = form.role !== "MASYARAKAT";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const { data } = await apiClient.post("/auth/register", {
        nama: form.nama,
        email: form.email,
        password: form.password,
        role: form.role,
        ...(needsWilayah && form.wilayahScope ? { wilayahScope: form.wilayahScope } : {}),
      });
      setSuccess(data.message);
      setTimeout(() => router.push("/login"), 1800);
    } catch (err) {
      setError(apiErrorMessage(err, "Registrasi gagal"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-[18px] font-extrabold tracking-tight">Buat akun baru</h1>
        <p className="text-muted text-[12.5px] mt-1">Role selain Masyarakat butuh verifikasi admin.</p>
      </div>
      <ErrorText>{error}</ErrorText>
      <SuccessText>{success}</SuccessText>
      <Field label="Nama lengkap">
        <Input required value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Nama Anda" />
      </Field>
      <Field label="Email">
        <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nama@email.com" />
      </Field>
      <Field label="Password">
        <Input type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Minimal 8 karakter" />
      </Field>
      <Field label="Peran">
        <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </Select>
      </Field>
      {needsWilayah && (
        <Field label="Wilayah tugas">
          <Input required value={form.wilayahScope} onChange={(e) => setForm({ ...form, wilayahScope: e.target.value })} placeholder="contoh: Jakarta Selatan" />
        </Field>
      )}
      <PrimaryButton type="submit" disabled={loading}>
        <UserPlus className="w-4 h-4" />
        {loading ? "Memproses..." : "Daftar"}
      </PrimaryButton>
      <p className="text-[12.5px] text-muted text-center">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Masuk
        </Link>
      </p>
    </form>
  );
}
