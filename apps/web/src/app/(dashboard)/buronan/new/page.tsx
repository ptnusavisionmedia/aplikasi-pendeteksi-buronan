"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Upload, UserSearch, X } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { Field, Input, Select, PrimaryButton, ErrorText } from "@/components/form";

const MIN_PHOTO_SIZE = 480;

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("File bukan gambar yang valid"));
    };
    img.src = url;
  });
}

export default function NewBuronanPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ nama: "", nik: "", nomorKasus: "", tingkatAncaman: "Sedang" });
  const [photo, setPhoto] = useState<{ file: File; previewUrl: string; width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const { width, height } = await readImageDimensions(file);
      if (width < MIN_PHOTO_SIZE || height < MIN_PHOTO_SIZE) {
        setError(`Resolusi foto terlalu rendah (minimum ${MIN_PHOTO_SIZE}x${MIN_PHOTO_SIZE}px) — pilih foto wajah yang lebih jelas.`);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
      setPhoto({ file, previewUrl: URL.createObjectURL(file), width, height });
    } catch {
      setError("File bukan gambar yang valid.");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removePhoto() {
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    setPhoto(null);
    if (fileRef.current) fileRef.current.value = "";
  }

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

      if (photo) {
        const formData = new FormData();
        formData.append("foto", photo.file);
        formData.append("isPrimary", "true");
        formData.append("angle", "FRONTAL");
        formData.append("width", String(photo.width));
        formData.append("height", String(photo.height));
        // Buronan sudah tersimpan di titik ini — kalau upload foto gagal, tetap lanjut ke
        // halaman detail (foto bisa ditambahkan/diulang dari sana) daripada membuat duplikat
        // dengan submit ulang form ini.
        await apiClient
          .post(`/buronan/${data.id}/foto`, formData, { headers: { "Content-Type": "multipart/form-data" } })
          .catch((err) => console.error("Gagal mengunggah foto saat pembuatan buronan:", err));
      }

      router.push(`/buronan/${data.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, "Gagal menambahkan buronan"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-md">
        <h1 className="text-[22px] font-extrabold tracking-tight mb-1 text-center">Tambah Buronan</h1>
        <p className="text-muted text-[13px] mb-6 text-center">
          Sertakan foto wajah sekarang supaya langsung bisa dicocokkan dari CCTV — bisa juga ditambah/dilengkapi nanti.
        </p>

        <form onSubmit={onSubmit} className="bento-cell flex flex-col gap-4">
          <ErrorText>{error}</ErrorText>

          <Field label="Foto wajah (opsional, bisa ditambah nanti)">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
            {photo ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.previewUrl} alt="Pratinjau foto" className="w-16 h-16 rounded-xl object-cover border border-line" />
                <div className="flex-1 min-w-0 text-[12px] text-muted">
                  {photo.file.name} &middot; {photo.width}x{photo.height}
                </div>
                <button type="button" onClick={removePhoto} className="icon-badge bg-canvas hover:bg-line transition-colors shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-3 bg-canvas border border-dashed border-line rounded-xl px-3.5 py-3 text-left hover:border-primary transition-colors"
              >
                <div className="icon-badge bg-surface shrink-0">
                  <UserSearch className="w-[18px] h-[18px] text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" /> Pilih foto
                  </div>
                  <div className="text-[11.5px] text-muted">Wajah menghadap depan, minimum {MIN_PHOTO_SIZE}x{MIN_PHOTO_SIZE}px</div>
                </div>
              </button>
            )}
          </Field>

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
    </div>
  );
}
