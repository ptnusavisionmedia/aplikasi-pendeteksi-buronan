"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bell, ScanFace } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Badge } from "@/components/form";
import type { Notification } from "@/lib/types";

export default function NotifikasiPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await apiClient.get<Notification[]>("/notifications")).data,
  });

  return (
    <div>
      <h1 className="text-[22px] font-extrabold tracking-tight mb-1">Notifikasi</h1>
      <p className="text-muted text-[13px] mb-6">{data?.length ?? 0} notifikasi untuk Anda</p>

      <div className="flex flex-col gap-2">
        {isLoading && <p className="text-[13px] text-muted">Memuat...</p>}
        {!isLoading && data?.length === 0 && (
          <div className="bento-cell flex flex-col items-center justify-center py-10 text-muted">
            <Bell className="w-6 h-6 mb-2" />
            <p className="text-[13px]">Belum ada notifikasi.</p>
          </div>
        )}
        {data?.map((n) => (
          <Link
            key={n.id}
            href={n.detectionEvent ? `/cctv/${n.detectionEventId}` : "#"}
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
    </div>
  );
}
