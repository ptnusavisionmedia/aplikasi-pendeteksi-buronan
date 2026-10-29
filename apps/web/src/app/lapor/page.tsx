"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ShieldAlert, Camera, Send } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { Field, Input, Textarea, PrimaryButton, ErrorText, Checkbox } from "@/components/form";

export default function LaporPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [lokasi, setLokasi] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [anonim, setAnonim] = useState(true);
  const [foto, setFoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!foto) {
      setError("Foto wajib dilampirkan");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("lokasi", lokasi);
      if (deskripsi) formData.append("deskripsi", deskripsi);
      formData.append("anonim", String(anonim));
      formData.append("foto", foto);
      const { data } = await apiClient.post("/reports", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setTicketId(data.ticketId);
    } catch (err) {
      setError(apiErrorMessage(err, "Gagal mengirim laporan"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center gap-2.5 mb-6 justify-center">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white">
            <ShieldAlert className="w-[20px] h-[20px]" />
          </div>
          <span className="font-extrabold text-[17px] tracking-tight">Sigap Buronan</span>
        </div>

        <div className="bento-cell shadow-card">
          {ticketId ? (
            <div className="text-center py-6">
              <h1 className="text-[18px] font-extrabold mb-2">Laporan terkirim</h1>
              <p className="text-muted text-[13px] mb-4">Simpan nomor tiket ini untuk mengecek status laporan Anda.</p>
              <div className="bg-primary-soft text-primary-ink font-bold text-[18px] tracking-wide rounded-xl py-3 mb-5">
                {ticketId}
              </div>
              <Link href={`/status?ticketId=${ticketId}`} className="text-[12.5px] font-semibold text-primary hover:underline">
                Cek status laporan
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div>
                <h1 className="text-[18px] font-extrabold tracking-tight">Laporkan Buronan</h1>
                <p className="text-muted text-[12.5px] mt-1">Bantu temukan buronan dengan melaporkan ciri yang Anda lihat.</p>
              </div>
              <ErrorText>{error}</ErrorText>

              <input ref={fileRef} type="file" accept="image/*" required className="hidden" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line rounded-xl py-8 text-muted hover:border-primary transition-colors"
              >
                <Camera className="w-6 h-6" />
                <span className="text-[12.5px] font-semibold">{foto ? foto.name : "Ambil / unggah foto"}</span>
              </button>

              <Field label="Lokasi">
                <Input required value={lokasi} onChange={(e) => setLokasi(e.target.value)} placeholder="contoh: Dekat Pasar Santa, Jaksel" />
              </Field>
              <Field label="Deskripsi (opsional)">
                <Textarea rows={3} value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} placeholder="Ciri-ciri, waktu, situasi..." />
              </Field>
              <label className="flex items-center gap-2 text-[12.5px]">
                <Checkbox checked={anonim} onChange={(e) => setAnonim(e.target.checked)} />
                Kirim sebagai laporan anonim
              </label>

              <PrimaryButton type="submit" disabled={loading}>
                <Send className="w-4 h-4" />
                {loading ? "Mengirim..." : "Kirim Laporan"}
              </PrimaryButton>
              <p className="text-[12.5px] text-muted text-center">
                <Link href="/status" className="font-semibold text-primary hover:underline">
                  Cek status laporan sebelumnya
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
