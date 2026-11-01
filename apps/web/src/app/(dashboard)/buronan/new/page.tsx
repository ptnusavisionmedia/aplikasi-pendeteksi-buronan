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
  const [photos, setPhotos] = useState<{ file: File; previewUrl: string; width: number; height: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError(null);
    const accepted: typeof photos = [];
    for (const file of files) {
      try {
        const { width, height } = await readImageDimensions(file);
        if (width < MIN_PHOTO_SIZE || height < MIN_PHOTO_SIZE) {
          setError(`Resolusi foto "${file.name}" terlalu rendah (minimum ${MIN_PHOTO_SIZE}x${MIN_PHOTO_SIZE}px) — foto ini dilewati.`);
          continue;
        }
        accepted.push({ file, previewUrl: URL.createObjectURL(file), width, height });
      } catch {
        setError(`File "${file.name}" bukan gambar yang valid — foto ini dilewati.`);
      }
    }
    setPhotos((prev) => [...prev, ...accepted]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
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

      // Buronan sudah tersimpan di titik ini — kalau upload foto gagal, tetap lanjut ke
      // halaman detail (foto bisa ditambahkan/diulang dari sana) daripada membuat duplikat
      // dengan submit ulang form ini. Foto pertama didaftarkan lewat /foto (FR-21: metadata
      // sudut + resolusi) agar jadi foto utama; sisanya lewat /foto/bulk sekaligus.
      if (photos.length > 0) {
        const [primary, ...rest] = photos;
        const primaryFormData = new FormData();
        primaryFormData.append("foto", primary.file);
        primaryFormData.append("isPrimary", "true");
        primaryFormData.append("angle", "FRONTAL");
        primaryFormData.append("width", String(primary.width));
        primaryFormData.append("height", String(primary.height));
        await apiClient
          .post(`/buronan/${data.id}/foto`, primaryFormData, { headers: { "Content-Type": "multipart/form-data" } })
          .catch((err) => console.error("Gagal mengunggah foto saat pembuatan buronan:", err));

        if (rest.length > 0) {
          const bulkFormData = new FormData();
          rest.forEach((p) => bulkFormData.append("fotos", p.file));
          await apiClient
            .post(`/buronan/${data.id}/foto/bulk`, bulkFormData, { headers: { "Content-Type": "multipart/form-data" } })
            .catch((err) => console.error("Gagal mengunggah foto tambahan saat pembuatan buronan:", err));
        }
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

          <Field label="Foto wajah (opsional, bisa ditambah nanti, bisa pilih beberapa)">
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPhotoChange} />
            {photos.length > 0 && (
              <div className="flex flex-col gap-2 mb-2">
                {photos.map((photo, i) => (
                  <div key={photo.previewUrl} className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.previewUrl} alt="Pratinjau foto" className="w-16 h-16 rounded-xl object-cover border border-line" />
                    <div className="flex-1 min-w-0 text-[12px] text-muted">
                      {photo.file.name} &middot; {photo.width}x{photo.height}
                      {i === 0 && <span className="text-primary font-semibold"> &middot; utama</span>}
                    </div>
                    <button type="button" onClick={() => removePhoto(i)} className="icon-badge bg-canvas hover:bg-line transition-colors shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
                  <Upload className="w-3.5 h-3.5" /> {photos.length > 0 ? "Tambah foto lagi" : "Pilih foto"}
                </div>
                <div className="text-[11.5px] text-muted">Wajah menghadap depan, minimum {MIN_PHOTO_SIZE}x{MIN_PHOTO_SIZE}px</div>
              </div>
            </button>
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
