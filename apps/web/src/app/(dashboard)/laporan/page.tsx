"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, Trash2 } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { GhostButton, PrimaryButton, Select } from "@/components/form";
import { RetryImage } from "@/components/retry-image";
import type { Report, ReportStatus } from "@/lib/types";

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
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["reports", statusFilter],
    queryFn: async () =>
      (await apiClient.get<Report[]>("/reports", { params: { status: statusFilter } })).data,
  });

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
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight mb-1">Laporan Masyarakat</h1>
          <p className="text-muted text-[13px]">{data?.length ?? 0} laporan</p>
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ReportStatus | "ALL")} className="w-[220px]">
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {isLoading && <p className="text-[13px] text-muted col-span-3">Memuat...</p>}
        {!isLoading && data?.length === 0 && (
          <div className="bento-cell col-span-3 flex flex-col items-center justify-center py-10 text-muted">
            <Flag className="w-6 h-6 mb-2" />
            <p className="text-[13px]">Tidak ada laporan untuk status ini.</p>
          </div>
        )}
        {data?.map((report) => (
          <div key={report.id} className="bento-cell flex flex-col gap-3">
            <div className="w-full aspect-square rounded-xl bg-canvas overflow-hidden">
              <RetryImage src={report.fotoUrl} alt="Laporan" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-[13.5px]">Tiket #{report.ticketId}</div>
                {canDelete && (
                  <button
                    onClick={() => deleteReport(report)}
                    aria-label="Hapus laporan"
                    className="flex items-center justify-center w-7 h-7 shrink-0 text-coral bg-coral-soft hover:bg-coral hover:text-white transition-colors rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="text-[12px] text-muted">{report.lokasi}</div>
              {report.deskripsi && <div className="text-[12px] text-muted mt-1">{report.deskripsi}</div>}
            </div>
            {report.detectionEvents?.[0] && (
              <div className="text-[11.5px] bg-amber-soft text-amber rounded-lg px-2.5 py-1.5 font-semibold">
                Kemungkinan: {report.detectionEvents[0].buronan?.nama ?? "-"} ({Math.round(report.detectionEvents[0].confidenceScore * 100)}%)
              </div>
            )}
            {report.status === "MENUNGGU_VERIFIKASI" ? (
              <>
                <div className="flex gap-2">
                  <PrimaryButton type="button" className="flex-1 text-[12px]" onClick={() => verify(report.id, "VALID")}>
                    Valid
                  </PrimaryButton>
                  <GhostButton type="button" className="flex-1 text-[12px]" onClick={() => verify(report.id, "TIDAK_VALID")}>
                    Tidak Valid
                  </GhostButton>
                </div>
                <GhostButton type="button" className="text-[12px]" onClick={() => verify(report.id, "INVESTIGASI_LANJUTAN")}>
                  Investigasi Lanjutan
                </GhostButton>
              </>
            ) : (
              <div className="text-[11.5px] font-semibold text-muted">Status: {report.status}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
