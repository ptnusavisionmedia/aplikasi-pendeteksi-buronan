"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bell, ScanFace } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Badge } from "@/components/form";
import { SearchBar, Pagination } from "@/components/list-controls";
import type { Notification, PaginatedResult } from "@/lib/types";

export default function NotifikasiPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", { q, page }],
    queryFn: async () =>
      (await apiClient.get<PaginatedResult<Notification>>("/notifications", { params: { q: q || undefined, page, limit: 20 } })).data,
  });
  const notifications = data?.items ?? [];

  return (
    <div>
      <h1 className="text-[22px] font-extrabold tracking-tight mb-1">Notifikasi</h1>
      <p className="text-muted text-[13px] mb-4">{data?.total ?? 0} notifikasi untuk Anda</p>

      <div className="mb-4">
        <SearchBar value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Cari nama buronan..." />
      </div>

      <div className="flex flex-col gap-2">
        {isLoading && <p className="text-[13px] text-muted">Memuat...</p>}
        {!isLoading && notifications.length === 0 && (
          <div className="bento-cell flex flex-col items-center justify-center py-10 text-muted">
            <Bell className="w-6 h-6 mb-2" />
            <p className="text-[13px]">Belum ada notifikasi.</p>
          </div>
        )}
        {notifications.map((n) => (
          <Link
            key={n.id}
            href={n.detectionEvent ? `/deteksi/${n.detectionEventId}` : "#"}
            className="bento-cell flex items-center gap-3 hover:border-primary transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-canvas flex items-center justify-center text-muted">
              <ScanFace className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate">
                {n.detectionEvent?.buronan?.nama ?? "Deteksi"} &middot; {n.detectionEvent?.cctvFeed?.lokasi ?? "-"}
              </div>
              <div className="text-[11.5px] text-muted">{new Date(n.createdAt).toLocaleString("id-ID")} &middot; {n.channel}</div>
            </div>
            <Badge tone={n.status === "SENT" ? "primary" : n.status === "FAILED" ? "coral" : "muted"}>{n.status}</Badge>
          </Link>
        ))}
      </div>

      <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} onPageChange={setPage} />
    </div>
  );
}
