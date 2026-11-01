"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Siren, Trash2, X } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { Badge, Select } from "@/components/form";
import { RetryImage } from "@/components/retry-image";
import { SearchBar, Pagination } from "@/components/list-controls";
import { ExportButtons } from "@/components/export-buttons";
import type { Escalation, EscalationStatus, PaginatedResult } from "@/lib/types";

const STATUS_TONE: Record<EscalationStatus, "amber" | "primary" | "coral"> = {
  PENDING: "amber",
  DITINDAKLANJUTI: "primary",
  SELESAI: "coral",
};

const STATUS_LABEL: Record<EscalationStatus, string> = {
  PENDING: "Pending",
  DITINDAKLANJUTI: "Ditindaklanjuti",
  SELESAI: "Selesai",
};

export default function EskalasiPage() {
  const user = useAuthStore((s) => s.user);
  const canUpdate = user?.role === "ADMIN" || user?.role === "APARAT";
  const canDelete = user?.role === "ADMIN";
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: stats } = useQuery({
    queryKey: ["escalations", "stats"],
    queryFn: async () =>
      (await apiClient.get<{ PENDING: number; DITINDAKLANJUTI: number; SELESAI: number; total: number }>(
        "/escalations/stats"
      )).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["escalations", { q, page }],
    queryFn: async () =>
      (await apiClient.get<PaginatedResult<Escalation>>("/escalations", { params: { q: q || undefined, page, limit: 20 } })).data,
  });
  const escalations = data?.items ?? [];

  const { data: detail } = useQuery({
    queryKey: ["escalations", "detail", detailId],
    enabled: !!detailId,
    queryFn: async () => (await apiClient.get<Escalation>(`/escalations/${detailId}`)).data,
  });

  async function updateStatus(id: string, status: EscalationStatus) {
    await apiClient.patch(`/escalations/${id}`, { status });
    queryClient.invalidateQueries({ queryKey: ["escalations"] });
  }

  async function deleteEscalation(esc: Escalation) {
    if (!window.confirm(`Hapus eskalasi untuk "${esc.detectionEvent?.buronan?.nama ?? "deteksi ini"}"? Tindakan ini tidak bisa dibatalkan.`)) {
      return;
    }
    try {
      await apiClient.delete(`/escalations/${esc.id}`);
      if (detailId === esc.id) setDetailId(null);
      queryClient.invalidateQueries({ queryKey: ["escalations"] });
    } catch (err) {
      window.alert(apiErrorMessage(err, "Gagal menghapus eskalasi"));
    }
  }

  const exportRows = escalations.map((esc) => [
    esc.detectionEvent?.buronan?.nama ?? "-",
    esc.instansiTujuan?.nama ?? "-",
    STATUS_LABEL[esc.status],
    esc.catatan ?? "-",
    new Date(esc.createdAt).toLocaleString("id-ID"),
  ]);

  return (
    <div>
      <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Eskalasi</h1>
          <p className="text-muted text-[13px] mt-1">{data?.total ?? 0} kasus eskalasi</p>
        </div>
        <ExportButtons
          title="Eskalasi"
          filenameBase="eskalasi"
          headers={["Buronan", "Instansi Tujuan", "Status", "Catatan", "Waktu"]}
          rows={exportRows}
        />
      </div>

      {/* FR item 3/7: ringkasan status, konsisten dengan kartu di Overview */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bento-cell flex items-center justify-between">
          <div>
            <div className="text-2xl font-extrabold tabular">{stats?.PENDING ?? "–"}</div>
            <div className="text-[12px] text-muted">Pending</div>
          </div>
          <div className="icon-badge bg-amber-soft">
            <Siren className="text-amber w-[18px] h-[18px]" />
          </div>
        </div>
        <div className="bento-cell flex items-center justify-between">
          <div>
            <div className="text-2xl font-extrabold tabular">{stats?.DITINDAKLANJUTI ?? "–"}</div>
            <div className="text-[12px] text-muted">Ditindaklanjuti</div>
          </div>
          <div className="icon-badge bg-primary-soft">
            <Siren className="text-primary w-[18px] h-[18px]" />
          </div>
        </div>
        <div className="bento-cell flex items-center justify-between">
          <div>
            <div className="text-2xl font-extrabold tabular">{stats?.SELESAI ?? "–"}</div>
            <div className="text-[12px] text-muted">Selesai</div>
          </div>
          <div className="icon-badge bg-canvas">
            <Siren className="text-safe w-[18px] h-[18px]" />
          </div>
        </div>
      </div>

      <div className="mb-4">
        <SearchBar value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Cari nama buronan atau instansi..." />
      </div>

      <div className="flex flex-col gap-2">
        {isLoading && <p className="text-[13px] text-muted">Memuat...</p>}
        {!isLoading && escalations.length === 0 && (
          <div className="bento-cell flex flex-col items-center justify-center py-10 text-muted">
            <Siren className="w-6 h-6 mb-2" />
            <p className="text-[13px]">Belum ada eskalasi.</p>
          </div>
        )}
        {escalations.map((esc) => (
          <button
            key={esc.id}
            onClick={() => setDetailId(esc.id)}
            className="bento-cell flex items-center gap-3 hover:border-primary transition-colors text-left w-full"
          >
            <div className="w-9 h-9 rounded-lg bg-coral-soft flex items-center justify-center text-coral shrink-0">
              <Siren className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate">
                {esc.detectionEvent?.buronan?.nama ?? "Deteksi"} &middot; {esc.instansiTujuan?.nama ?? "-"}
              </div>
              <div className="text-[11.5px] text-muted truncate">{esc.catatan ?? "Tanpa catatan"}</div>
              <div className="text-[11px] text-muted">{new Date(esc.createdAt).toLocaleString("id-ID")}</div>
            </div>
            {canUpdate ? (
              <Select
                value={esc.status}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => { e.stopPropagation(); updateStatus(esc.id, e.target.value as EscalationStatus); }}
                className="w-[180px]"
              >
                <option value="PENDING">Pending</option>
                <option value="DITINDAKLANJUTI">Ditindaklanjuti</option>
                <option value="SELESAI">Selesai</option>
              </Select>
            ) : (
              <Badge tone={STATUS_TONE[esc.status]}>{STATUS_LABEL[esc.status]}</Badge>
            )}
            {canDelete && (
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); deleteEscalation(esc); }}
                aria-label="Hapus eskalasi"
                className="flex items-center justify-center w-8 h-8 shrink-0 text-coral bg-coral-soft hover:bg-coral hover:text-white transition-colors rounded-lg"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </span>
            )}
          </button>
        ))}
      </div>

      <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} onPageChange={setPage} />

      {detailId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetailId(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h2 className="font-bold text-[16px]">Detail Eskalasi</h2>
              <button onClick={() => setDetailId(null)} className="text-muted hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>
            {!detail ? (
              <p className="text-[13px] text-muted">Memuat...</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  {detail.detectionEvent?.evidence?.fileUrl && (
                    <RetryImage
                      src={detail.detectionEvent.evidence.fileUrl}
                      alt="Evidence"
                      className="w-20 h-20 rounded-lg object-cover shrink-0 bg-canvas"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-[14px]">{detail.detectionEvent?.buronan?.nama ?? "Deteksi"}</div>
                    <div className="text-[12px] text-muted">{detail.detectionEvent?.cctvFeed?.lokasi ?? "Upload manual"}</div>
                    <div className="text-[11.5px] text-muted mt-1">
                      Kemiripan: {Math.round((detail.detectionEvent?.confidenceScore ?? 0) * 100)}%
                    </div>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-y-2 text-[12.5px]">
                  <dt className="text-muted">Status</dt>
                  <dd className="text-right"><Badge tone={STATUS_TONE[detail.status]}>{STATUS_LABEL[detail.status]}</Badge></dd>
                  <dt className="text-muted">Instansi Tujuan</dt>
                  <dd className="text-right font-semibold">{detail.instansiTujuan?.nama ?? "-"}</dd>
                  <dt className="text-muted">Dibuat Oleh</dt>
                  <dd className="text-right font-semibold">{detail.dibuatOleh?.nama ?? "-"}</dd>
                  <dt className="text-muted">Waktu Eskalasi</dt>
                  <dd className="text-right font-semibold">{new Date(detail.createdAt).toLocaleString("id-ID")}</dd>
                </dl>
                {detail.catatan && (
                  <div className="text-[12.5px] bg-canvas rounded-lg px-3 py-2.5">
                    <span className="font-semibold">Catatan:</span> {detail.catatan}
                  </div>
                )}
                {canUpdate && (
                  <Select
                    value={detail.status}
                    onChange={(e) => updateStatus(detail.id, e.target.value as EscalationStatus)}
                    className="w-full"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="DITINDAKLANJUTI">Ditindaklanjuti</option>
                    <option value="SELESAI">Selesai</option>
                  </Select>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
