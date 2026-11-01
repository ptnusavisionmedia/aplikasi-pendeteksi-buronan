"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Newspaper, Pencil, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { Field, Input, Textarea, Select, PrimaryButton, GhostButton, ErrorText, Badge } from "@/components/form";
import { Modal } from "@/components/modal";
import { RetryImage } from "@/components/retry-image";
import { SearchBar, Pagination } from "@/components/list-controls";
import type { BeritaAcara, BeritaAcaraStatus, PaginatedResult } from "@/lib/types";

const STATUS_FILTERS: { value: BeritaAcaraStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Semua Status" },
  { value: "TERBIT", label: "Terbit" },
  { value: "DRAFT", label: "Draf" },
  { value: "ARSIP", label: "Arsip" },
];

const STATUS_TONE: Record<BeritaAcaraStatus, "primary" | "muted" | "amber"> = {
  TERBIT: "primary",
  DRAFT: "amber",
  ARSIP: "muted",
};

const EMPTY_FORM = { judul: "", ringkasan: "", isi: "", status: "DRAFT" as BeritaAcaraStatus };

/** CMS internal untuk Berita Acara — konten resmi yang ditampilkan ke masyarakat lewat mobile
 * app begitu statusnya TERBIT. DRAFT & ARSIP hanya terlihat di sini (dan lewat API untuk staf). */
export default function BeritaAcaraPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === "ADMIN" || user?.role === "APARAT" || user?.role === "KEAMANAN_SWASTA";
  const canDelete = user?.role === "ADMIN";
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [statusFilter, setStatusFilter] = useState<BeritaAcaraStatus | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BeritaAcara | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["berita-acara", { statusFilter, q, page }],
    queryFn: async () =>
      (
        await apiClient.get<PaginatedResult<BeritaAcara>>("/berita-acara", {
          params: { status: statusFilter, q: q || undefined, page, limit: 12 },
        })
      ).data,
  });
  const items = data?.items ?? [];

  function openCreateForm() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPhoto(null);
    setError(null);
    setShowForm(true);
  }

  function openEditForm(item: BeritaAcara) {
    setEditing(item);
    setForm({ judul: item.judul, ringkasan: item.ringkasan, isi: item.isi, status: item.status });
    setPhoto(null);
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("judul", form.judul);
      formData.append("ringkasan", form.ringkasan);
      formData.append("isi", form.isi);
      formData.append("status", form.status);
      if (photo) formData.append("foto", photo);

      if (editing) {
        await apiClient.patch(`/berita-acara/${editing.id}`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      } else {
        await apiClient.post("/berita-acara", formData, { headers: { "Content-Type": "multipart/form-data" } });
      }
      closeForm();
      queryClient.invalidateQueries({ queryKey: ["berita-acara"] });
    } catch (err) {
      setError(apiErrorMessage(err, editing ? "Gagal menyimpan perubahan" : "Gagal membuat berita acara"));
    } finally {
      setLoading(false);
    }
  }

  async function deleteItem(item: BeritaAcara) {
    if (!window.confirm(`Hapus berita acara "${item.judul}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await apiClient.delete(`/berita-acara/${item.id}`);
      queryClient.invalidateQueries({ queryKey: ["berita-acara"] });
    } catch (err) {
      window.alert(apiErrorMessage(err, "Gagal menghapus berita acara"));
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight mb-1">Berita Acara</h1>
          <p className="text-muted text-[13px]">{data?.total ?? 0} berita acara &middot; konten resmi yang tampil di aplikasi mobile saat berstatus Terbit</p>
        </div>
        {canManage && (
          <PrimaryButton type="button" onClick={openCreateForm}>
            <Plus className="w-4 h-4" /> Tulis Berita Acara
          </PrimaryButton>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <SearchBar value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Cari judul atau ringkasan..." />
        <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as BeritaAcaraStatus | "ALL"); setPage(1); }} className="w-[180px]">
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      {showForm && canManage && (
        <Modal
          title={editing ? `Edit — ${editing.judul}` : "Tulis Berita Acara"}
          description="Status Draf hanya terlihat di dashboard. Status Terbit langsung tampil ke masyarakat lewat aplikasi mobile."
          onClose={closeForm}
        >
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <ErrorText>{error}</ErrorText>

            <Field label="Judul">
              <Input autoFocus required value={form.judul} onChange={(e) => setForm({ ...form, judul: e.target.value })} />
            </Field>
            <Field label="Ringkasan (ditampilkan di daftar)">
              <Textarea required rows={2} value={form.ringkasan} onChange={(e) => setForm({ ...form, ringkasan: e.target.value })} />
            </Field>
            <Field label="Isi lengkap">
              <Textarea required rows={6} value={form.isi} onChange={(e) => setForm({ ...form, isi: e.target.value })} />
            </Field>
            <Field label="Foto (opsional)">
              <input ref={fileRef} type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="text-[12.5px]" />
              {editing?.fotoUrl && !photo && (
                <p className="text-[11.5px] text-muted mt-1">Sudah ada foto — pilih file baru untuk menggantinya.</p>
              )}
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as BeritaAcaraStatus })}>
                <option value="DRAFT">Draf</option>
                <option value="TERBIT">Terbit</option>
                <option value="ARSIP">Arsip</option>
              </Select>
            </Field>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <GhostButton type="button" onClick={closeForm} disabled={loading}>
                Batal
              </GhostButton>
              <PrimaryButton type="submit" disabled={loading}>
                {loading ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Simpan"}
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading && <p className="text-[13px] text-muted col-span-full">Memuat...</p>}
        {!isLoading && items.length === 0 && (
          <div className="bento-cell col-span-full flex flex-col items-center justify-center py-10 text-muted">
            <Newspaper className="w-6 h-6 mb-2" />
            <p className="text-[13px]">Belum ada berita acara.</p>
          </div>
        )}
        {items.map((item) => (
          <div key={item.id} className="bento-cell flex flex-col gap-3">
            {item.fotoUrl && (
              <div className="w-full aspect-video rounded-lg bg-canvas overflow-hidden">
                <RetryImage src={item.fotoUrl} alt={item.judul} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex items-start justify-between gap-2">
              <Badge tone={STATUS_TONE[item.status]}>{item.status}</Badge>
            </div>
            <div>
              <div className="font-bold text-[14px] leading-tight">{item.judul}</div>
              <p className="text-[12px] text-muted mt-1 line-clamp-2">{item.ringkasan}</p>
            </div>
            <div className="text-[11px] text-muted mt-auto pt-2 border-t border-line flex items-center justify-between">
              <span>
                {item.penulis?.nama ?? "-"} &middot;{" "}
                {new Date(item.publishedAt ?? item.createdAt).toLocaleDateString("id-ID")}
              </span>
              {canManage && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => openEditForm(item)}
                    aria-label={`Edit ${item.judul}`}
                    className={clsx("flex items-center justify-center w-7 h-7 text-ink bg-canvas hover:bg-line transition-colors rounded-lg")}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => deleteItem(item)}
                      aria-label={`Hapus ${item.judul}`}
                      className="flex items-center justify-center w-7 h-7 text-coral bg-coral-soft hover:bg-coral hover:text-white transition-colors rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} onPageChange={setPage} />
    </div>
  );
}
