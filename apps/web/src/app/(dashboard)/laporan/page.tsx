"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, Trash2 } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { GhostButton, PrimaryButton, Select } from "@/components/form";
import { RetryImage } from "@/components/retry-image";
import { SearchBar, Pagination } from "@/components/list-controls";
import type { PaginatedResult, Report, ReportStatus } from "@/lib/types";

const STATUS_FILTERS: { value: ReportStatus | "ALL"; label: string }[] = [
  { value: "MENUNGGU_VERIFIKASI", label: "Menunggu Verifikasi" },
  { value: "VALID", label: "Valid" },
  { value: "TIDAK_VALID", label: "Tidak Valid" },
  { value: "INVESTIGASI_LANJUTAN", label: "Investigasi Lanjutan" },
  { value: "ALL", label: "Semua Status" },
];

export default function LaporanPage() {
  const user = useAuthStore((s) => s.user);
  const canDelete = user?.role === "ADMIN";
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "ALL">("MENUNGGU_VERIFIKASI");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["reports", { statusFilter, q, page }],
    queryFn: async () =>
      (await apiClient.get<PaginatedResult<Report>>("/reports", {
        params: { status: statusFilter, q: q || undefined, page, limit: 24 },
      })).data,
  });
  const reports = data?.items ?? [];

  async function verify(id: string, status: ReportStatus) {
    await apiClient.patch(`/reports/${id}/verify`, { status });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
  }

  async function deleteReport(report: Report) {
    if (!window.confirm(`Hapus laporan tiket #${report.ticketId}? Tindakan ini tidak bisa dibatalkan.`)) {
      return;
    }
    try {
      await apiClient.delete(`/reports/${report.id}`);
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    } catch (err) {
      window.alert(apiErrorMessage(err, "Gagal menghapus laporan"));
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight mb-1">Laporan Masyarakat</h1>
          <p className="text-muted text-[13px]">{data?.total ?? 0} laporan</p>
        </div>
        <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as ReportStatus | "ALL"); setPage(1); }} className="w-[220px]">
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="mb-4">
        <SearchBar value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Cari lokasi atau deskripsi..." />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {isLoading && <p className="text-[13px] text-muted col-span-full">Memuat...</p>}
        {!isLoading && reports.length === 0 && (
          <div className="bento-cell col-span-full flex flex-col items-center justify-center py-10 text-muted">
            <Flag className="w-6 h-6 mb-2" />
            <p className="text-[13px]">Tidak ada laporan untuk status ini.</p>
          </div>
        )}
        {reports.map((report) => (
          <div key={report.id} className="bento-cell flex flex-col gap-2 p-3">
            <div className="w-full aspect-square rounded-lg bg-canvas overflow-hidden">
              <RetryImage src={report.fotoUrl} alt="Laporan" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-[12px] truncate">#{report.ticketId}</div>
                {canDelete && (
                  <button
                    onClick={() => deleteReport(report)}
                    aria-label="Hapus laporan"
                    className="flex items-center justify-center w-6 h-6 shrink-0 text-coral bg-coral-soft hover:bg-coral hover:text-white transition-colors rounded-lg"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="text-[11px] text-muted truncate">{report.lokasi}</div>
            </div>
            {report.detectionEvents?.[0] && (
              <div className="text-[10.5px] bg-amber-soft text-amber rounded-lg px-2 py-1 font-semibold truncate">
                {report.detectionEvents[0].buronan?.nama ?? "-"} ({Math.round(report.detectionEvents[0].confidenceScore * 100)}%)
              </div>
            )}
            {report.status === "MENUNGGU_VERIFIKASI" ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-1.5">
                  <PrimaryButton type="button" className="flex-1 text-[11px] px-2 py-1.5" onClick={() => verify(report.id, "VALID")}>
                    Valid
                  </PrimaryButton>
                  <GhostButton type="button" className="flex-1 text-[11px] px-2 py-1.5" onClick={() => verify(report.id, "TIDAK_VALID")}>
                    Tidak Valid
                  </GhostButton>
                </div>
                <GhostButton type="button" className="text-[11px] px-2 py-1.5" onClick={() => verify(report.id, "INVESTIGASI_LANJUTAN")}>
                  Investigasi Lanjutan
                </GhostButton>
              </div>
            ) : (
              <div className="text-[10.5px] font-semibold text-muted">Status: {report.status}</div>
            )}
          </div>
        ))}
      </div>

      <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} onPageChange={setPage} />
    </div>
  );
}
