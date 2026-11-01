"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Plus, UserSearch } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { Badge, Select } from "@/components/form";
import { RetryImage } from "@/components/retry-image";
import { SearchBar, Pagination } from "@/components/list-controls";
import { ExportButtons } from "@/components/export-buttons";
import type { Buronan, BuronanStatus, PaginatedResult } from "@/lib/types";

const STATUS_TONE: Record<BuronanStatus, "coral" | "primary" | "muted"> = {
  DPO_AKTIF: "coral",
  TERTANGKAP: "primary",
  DICABUT: "muted",
};

const STATUS_LABEL: Record<BuronanStatus, string> = {
  DPO_AKTIF: "DPO Aktif",
  TERTANGKAP: "Tertangkap",
  DICABUT: "Dicabut",
};

export default function BuronanListPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === "ADMIN" || user?.role === "INSTANSI_HUKUM";
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["buronan", { q, status, page }],
    queryFn: async () =>
      (await apiClient.get<PaginatedResult<Buronan>>("/buronan", {
        params: { q: q || undefined, status: status || undefined, page, limit: 24 },
      })).data,
  });
  const buronanList = data?.items ?? [];

  async function onAddPhotos(buronanId: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploadingId(buronanId);
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append("fotos", f));
      await apiClient.post(`/buronan/${buronanId}/foto/bulk`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      queryClient.invalidateQueries({ queryKey: ["buronan"] });
    } catch (err) {
      setUploadError(apiErrorMessage(err, "Gagal menambahkan foto"));
    } finally {
      setUploadingId(null);
      const input = fileRefs.current[buronanId];
      if (input) input.value = "";
    }
  }

  const exportRows = buronanList.map((b) => [b.nama, b.nik ?? "-", b.nomorKasus, b.tingkatAncaman, STATUS_LABEL[b.status]]);

  return (
    <div>
      <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Database Buronan</h1>
          <p className="text-muted text-[13px] mt-1">{data?.total ?? 0} data ditemukan</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButtons
            title="Database Buronan"
            filenameBase="database-buronan"
            headers={["Nama", "NIK", "Nomor Kasus", "Tingkat Ancaman", "Status"]}
            rows={exportRows}
          />
          {canManage && (
            <Link
              href="/buronan/new"
              className="flex items-center gap-2 bg-primary text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl shadow-pop hover:bg-primary-ink transition-colors"
            >
              <Plus className="w-4 h-4" /> Tambah Buronan
            </Link>
          )}
        </div>
      </div>

      {uploadError && (
        <div className="bento-cell mb-4 text-coral bg-coral-soft text-[13px] font-semibold">{uploadError}</div>
      )}

      <div className="flex gap-3 mb-4">
        <SearchBar value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Cari nama atau nomor kasus..." />
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-[180px]">
          <option value="">Semua status</option>
          <option value="DPO_AKTIF">DPO Aktif</option>
          <option value="TERTANGKAP">Tertangkap</option>
          <option value="DICABUT">Dicabut</option>
        </Select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {isLoading && <p className="text-[13px] text-muted col-span-full">Memuat data...</p>}
        {!isLoading && buronanList.length === 0 && (
          <div className="bento-cell col-span-full flex flex-col items-center justify-center py-10 text-muted">
            <UserSearch className="w-6 h-6 mb-2" />
            <p className="text-[13px]">Tidak ada data buronan.</p>
          </div>
        )}
        {buronanList.map((b) => (
          <div key={b.id} className="bento-cell flex flex-col gap-2 p-3">
            <div className="w-full aspect-square rounded-lg bg-canvas overflow-hidden flex items-center justify-center text-muted">
              {b.fotos?.[0]?.urlFoto ? (
                <RetryImage src={b.fotos[0].urlFoto} alt={b.nama} className="w-full h-full object-cover" />
              ) : (
                <UserSearch className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="font-bold text-[12.5px] truncate">{b.nama}</div>
              <div className="text-[11px] text-muted truncate">Kasus #{b.nomorKasus}</div>
            </div>
            <div className="flex items-center justify-between">
              <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
              <span className="text-[10.5px] text-muted">{b.tingkatAncaman}</span>
            </div>
            <div className="flex gap-1.5 mt-auto">
              {canManage && (
                <>
                  <input
                    ref={(el) => { fileRefs.current[b.id] = el; }}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => onAddPhotos(b.id, e.target.files)}
                  />
                  <button
                    type="button"
                    onClick={() => fileRefs.current[b.id]?.click()}
                    disabled={uploadingId === b.id}
                    title="Tambah foto untuk latihan model"
                    className="flex items-center justify-center w-7 h-7 shrink-0 text-primary bg-primary-soft hover:bg-primary hover:text-white transition-colors rounded-lg disabled:opacity-50"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <Link
                href={`/buronan/${b.id}`}
                className="flex-1 text-center text-[11.5px] font-semibold bg-canvas hover:bg-line transition-colors rounded-lg px-2 py-1.5"
              >
                Detail
              </Link>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} onPageChange={setPage} />
    </div>
  );
}
