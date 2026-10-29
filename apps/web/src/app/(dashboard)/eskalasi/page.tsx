"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Siren } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { Badge, Select } from "@/components/form";
import type { Escalation, EscalationStatus } from "@/lib/types";

const STATUS_TONE: Record<EscalationStatus, "amber" | "primary" | "coral"> = {
  PENDING: "amber",
  DITINDAKLANJUTI: "primary",
  SELESAI: "coral",
};

export default function EskalasiPage() {
  const user = useAuthStore((s) => s.user);
  const canUpdate = user?.role === "ADMIN" || user?.role === "APARAT";
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["escalations"],
    queryFn: async () => (await apiClient.get<Escalation[]>("/escalations")).data,
  });

  async function updateStatus(id: string, status: EscalationStatus) {
    await apiClient.patch(`/escalations/${id}`, { status });
    queryClient.invalidateQueries({ queryKey: ["escalations"] });
  }

  return (
    <div>
      <h1 className="text-[22px] font-extrabold tracking-tight mb-1">Eskalasi</h1>
      <p className="text-muted text-[13px] mb-6">{data?.length ?? 0} kasus eskalasi</p>

      <div className="flex flex-col gap-2">
        {isLoading && <p className="text-[13px] text-muted">Memuat...</p>}
        {!isLoading && data?.length === 0 && (
          <div className="bento-cell flex flex-col items-center justify-center py-10 text-muted">
            <Siren className="w-6 h-6 mb-2" />
            <p className="text-[13px]">Belum ada eskalasi.</p>
          </div>
        )}
        {data?.map((esc) => (
          <div key={esc.id} className="bento-cell flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-coral-soft flex items-center justify-center text-coral">
              <Siren className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate">
                {esc.detectionEvent?.buronan?.nama ?? "Deteksi"}
              </div>
              <div className="text-[11.5px] text-muted truncate">{esc.catatan ?? "Tanpa catatan"}</div>
              <div className="text-[11px] text-muted">{new Date(esc.createdAt).toLocaleString("id-ID")}</div>
            </div>
            {canUpdate ? (
              <Select value={esc.status} onChange={(e) => updateStatus(esc.id, e.target.value as EscalationStatus)} className="w-[180px]">
                <option value="PENDING">Pending</option>
                <option value="DITINDAKLANJUTI">Ditindaklanjuti</option>
                <option value="SELESAI">Selesai</option>
              </Select>
            ) : (
              <Badge tone={STATUS_TONE[esc.status]}>{esc.status}</Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
