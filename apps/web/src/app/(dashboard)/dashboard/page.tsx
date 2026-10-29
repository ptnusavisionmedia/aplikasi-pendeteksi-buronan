"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { UserX, ScanFace, Camera, Flag, TrendingUp, Siren } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { Badge } from "@/components/form";
import type { Buronan, CctvFeed, DetectionEvent, Report } from "@/lib/types";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const { data: buronanList } = useQuery({
    queryKey: ["buronan", "dashboard"],
    queryFn: async () => (await apiClient.get<Buronan[]>("/buronan", { params: { status: "DPO_AKTIF" } })).data,
  });

  const { data: detections } = useQuery({
    queryKey: ["detections", "dashboard"],
    queryFn: async () => (await apiClient.get<DetectionEvent[]>("/detections")).data,
  });

  const { data: feeds } = useQuery({
    queryKey: ["cctv-feeds", "dashboard"],
    queryFn: async () => (await apiClient.get<CctvFeed[]>("/cctv-feeds")).data,
  });

  const { data: reports } = useQuery({
    queryKey: ["reports", "dashboard"],
    enabled: user?.role !== "MASYARAKAT",
    queryFn: async () => (await apiClient.get<Report[]>("/reports")).data,
  });

  const today = new Date().toDateString();
  const detectionsToday = detections?.filter((d) => new Date(d.detectedAt).toDateString() === today) ?? [];
  const feedsOnline = feeds?.filter((f) => f.status === "ACTIVE").length ?? 0;
  const recentDetections = (detections ?? []).slice(0, 3);

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Ringkasan Hari Ini</h1>
          <p className="text-muted text-[13px] mt-1">
            {user?.wilayahScope ? `Wilayah ${user.wilayahScope}` : "Seluruh wilayah"} &middot; data langsung dari server
          </p>
        </div>
        <Link
          href="/buronan/new"
          className="flex items-center gap-2 bg-primary text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl shadow-pop hover:bg-primary-ink transition-colors"
        >
          Tambah Buronan
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4 auto-rows-[108px]">
        <div className="bento-cell col-span-1 row-span-1 flex flex-col justify-between">
          <UserX className="text-primary w-[18px] h-[18px]" />
          <div>
            <div className="text-2xl font-extrabold tabular">{buronanList?.length ?? "–"}</div>
            <div className="text-[12px] text-muted">DPO Aktif</div>
          </div>
        </div>

        <div className="bento-cell col-span-1 row-span-1 flex flex-col justify-between">
          <ScanFace className="text-coral w-[18px] h-[18px]" />
          <div>
            <div className="text-2xl font-extrabold tabular">{detectionsToday.length}</div>
            <div className="text-[12px] text-muted">Deteksi hari ini</div>
          </div>
        </div>

        <div className="bento-cell col-span-2 row-span-2 bg-primary text-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-semibold uppercase tracking-wide opacity-80">Total Deteksi Tercatat</span>
            <TrendingUp className="w-[18px] h-[18px]" />
          </div>
          <div className="text-4xl font-extrabold tabular">{detections?.length ?? "–"}</div>
          <div className="text-[12px] opacity-80">{detectionsToday.length} deteksi hari ini</div>
        </div>

        <div className="bento-cell col-span-1 row-span-1 flex flex-col justify-between">
          <Camera className="text-ink w-[18px] h-[18px]" />
          <div>
            <div className="text-2xl font-extrabold tabular">
              {feedsOnline}
              <span className="text-[13px] text-muted font-semibold">/{feeds?.length ?? 0}</span>
            </div>
            <div className="text-[12px] text-muted">CCTV aktif</div>
          </div>
        </div>

        <div className="bento-cell col-span-1 row-span-1 flex flex-col justify-between">
          <Flag className="text-amber w-[18px] h-[18px]" />
          <div>
            <div className="text-2xl font-extrabold tabular">
              {reports?.filter((r) => r.status === "MENUNGGU_VERIFIKASI").length ?? "–"}
            </div>
            <div className="text-[12px] text-muted">Laporan menunggu</div>
          </div>
        </div>

        <div className="bento-cell col-span-2 row-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-[14px]">Deteksi Terbaru</span>
            <Link href="/cctv" className="text-[12.5px] font-semibold text-primary hover:underline">
              Lihat semua
            </Link>
          </div>
          <div className="flex-1 flex flex-col gap-2.5 overflow-hidden">
            {recentDetections.length === 0 && <p className="text-[12.5px] text-muted">Belum ada deteksi.</p>}
            {recentDetections.map((d) => (
              <div key={d.id} className="flex items-center gap-3 rounded-xl bg-canvas px-3 py-2.5">
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-muted">
                  <ScanFace className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate">
                    {d.buronan?.nama ?? "Low-confidence"} &middot; {d.cctvFeed?.lokasi ?? "Upload manual"}
                  </div>
                  <div className="text-[11.5px] text-muted">{new Date(d.detectedAt).toLocaleString("id-ID")}</div>
                </div>
                <span className="text-[11px] font-bold text-muted">{Math.round(d.confidenceScore * 100)}%</span>
              </div>
            ))}
          </div>
        </div>

        <Link href="/eskalasi" className="bento-cell col-span-2 row-span-1 flex items-center justify-between hover:border-coral transition-colors">
          <div>
            <div className="font-bold text-[14px]">Eskalasi</div>
            <div className="text-[12px] text-muted">Kelola kasus yang ditindaklanjuti</div>
          </div>
          <Siren className="text-coral w-6 h-6" />
        </Link>

        <div className="bento-cell col-span-2 row-span-1 flex items-center justify-between">
          <div>
            <div className="font-bold text-[14px]">Status Anda</div>
            <div className="text-[12px] text-muted">
              Peran: <Badge tone="primary">{user?.role}</Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
