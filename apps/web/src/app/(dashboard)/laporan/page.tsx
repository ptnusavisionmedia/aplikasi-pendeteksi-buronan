"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { GhostButton, PrimaryButton } from "@/components/form";
import type { Report, ReportStatus } from "@/lib/types";

export default function LaporanPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => (await apiClient.get<Report[]>("/reports")).data,
  });

  async function verify(id: string, status: ReportStatus) {
    await apiClient.patch(`/reports/${id}/verify`, { status });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
  }

  return (
    <div>
      <h1 className="text-[22px] font-extrabold tracking-tight mb-1">Laporan Masyarakat</h1>
      <p className="text-muted text-[13px] mb-6">{data?.length ?? 0} laporan menunggu verifikasi</p>

      <div className="grid grid-cols-3 gap-4">
        {isLoading && <p className="text-[13px] text-muted col-span-3">Memuat...</p>}
        {!isLoading && data?.length === 0 && (
          <div className="bento-cell col-span-3 flex flex-col items-center justify-center py-10 text-muted">
            <Flag className="w-6 h-6 mb-2" />
            <p className="text-[13px]">Tidak ada laporan menunggu verifikasi.</p>
          </div>
        )}
        {data?.map((report) => (
          <div key={report.id} className="bento-cell flex flex-col gap-3">
            <div className="w-full aspect-square rounded-xl bg-canvas overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={report.fotoUrl} alt="Laporan" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="font-bold text-[13.5px]">Tiket #{report.ticketId}</div>
              <div className="text-[12px] text-muted">{report.lokasi}</div>
              {report.deskripsi && <div className="text-[12px] text-muted mt-1">{report.deskripsi}</div>}
            </div>
            {report.detectionEvents?.[0] && (
              <div className="text-[11.5px] bg-amber-soft text-amber rounded-lg px-2.5 py-1.5 font-semibold">
                Kemungkinan: {report.detectionEvents[0].buronan?.nama ?? "-"} ({Math.round(report.detectionEvents[0].confidenceScore * 100)}%)
              </div>
            )}
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
          </div>
        ))}
      </div>
    </div>
  );
}
