"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { UserX, ScanFace, Camera, Flag, TrendingUp, Siren } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { Badge } from "@/components/form";
import { DetectionsTrendChart, type TrendPoint } from "@/components/detections-trend-chart";
import { DetectionStatusChart } from "@/components/detection-status-chart";
import type { PaginatedResult, CctvFeed, DetectionEvent } from "@/lib/types";

interface DetectionStats {
  total: number;
  todayCount: number;
  trend: TrendPoint[];
  statusBreakdown: Record<string, number>;
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const { data: buronanList } = useQuery({
    queryKey: ["buronan", "dashboard"],
    queryFn: async () =>
      (await apiClient.get<PaginatedResult<unknown>>("/buronan", { params: { status: "DPO_AKTIF", limit: 1 } })).data,
  });

  const { data: stats } = useQuery({
    queryKey: ["detections", "stats"],
    queryFn: async () => (await apiClient.get<DetectionStats>("/detections/stats")).data,
  });

  const { data: recent } = useQuery({
    queryKey: ["detections", "dashboard-recent"],
    queryFn: async () =>
      (await apiClient.get<PaginatedResult<DetectionEvent>>("/detections", { params: { limit: 3 } })).data,
  });

  const { data: feeds } = useQuery({
    queryKey: ["cctv-feeds", "dashboard"],
    queryFn: async () => (await apiClient.get<CctvFeed[]>("/cctv-feeds")).data,
  });

  const { data: reports } = useQuery({
    queryKey: ["reports", "dashboard"],
    enabled: user?.role !== "MASYARAKAT",
    queryFn: async () => (await apiClient.get<PaginatedResult<unknown>>("/reports", { params: { limit: 1 } })).data,
  });

  const { data: escalationStats } = useQuery({
    queryKey: ["escalations", "stats"],
    queryFn: async () =>
      (await apiClient.get<{ PENDING: number; DITINDAKLANJUTI: number; SELESAI: number; total: number }>(
        "/escalations/stats"
      )).data,
  });

  const feedsOnline = feeds?.filter((f) => f.status === "ACTIVE").length ?? 0;
  const recentDetections = recent?.items ?? [];

  return (
    <div>
      <div className="flex items-end justify-between gap-3 flex-wrap mb-6">
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

      {/* Hero: ringkasan total deteksi paling menonjol, baris sendiri di atas, dengan sparkline
          7 hari agar tidak hanya berupa angka polos. */}
      <div className="bento-cell bg-primary text-white flex items-center justify-between gap-4 flex-wrap mb-4">
        <div>
          <span className="text-[12.5px] font-semibold uppercase tracking-wide opacity-80">Total Deteksi Tercatat</span>
          <div className="text-4xl font-extrabold tabular mt-1">{stats?.total ?? "–"}</div>
          <div className="text-[12px] opacity-80 mt-1">{stats?.todayCount ?? 0} deteksi hari ini</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-28 h-12 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.trend ?? []} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="hero-sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="white" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="white" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="count" stroke="white" strokeWidth={2} fill="url(#hero-sparkline-gradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="icon-badge bg-white/15 w-12 h-12">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Statistik ringkas; 2 kolom di mobile, satu baris penuh mulai tablet agar mudah di-scan */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div className="bento-cell flex flex-col justify-between gap-3">
          <div className="icon-badge bg-primary-soft">
            <UserX className="text-primary w-[18px] h-[18px]" />
          </div>
          <div>
            <div className="text-2xl font-extrabold tabular">{buronanList?.total ?? "–"}</div>
            <div className="text-[12px] text-muted">DPO Aktif</div>
          </div>
        </div>

        <div className="bento-cell flex flex-col justify-between gap-3">
          <div className="icon-badge bg-coral-soft">
            <ScanFace className="text-coral w-[18px] h-[18px]" />
          </div>
          <div>
            <div className="text-2xl font-extrabold tabular">{stats?.todayCount ?? 0}</div>
            <div className="text-[12px] text-muted">Deteksi hari ini</div>
          </div>
        </div>

        <div className="bento-cell flex flex-col justify-between gap-3">
          <div className="icon-badge bg-canvas">
            <Camera className="text-ink w-[18px] h-[18px]" />
          </div>
          <div>
            <div className="text-2xl font-extrabold tabular">
              {feedsOnline}
              <span className="text-[13px] text-muted font-semibold">/{feeds?.length ?? 0}</span>
            </div>
            <div className="text-[12px] text-muted">CCTV aktif</div>
          </div>
        </div>

        <div className="bento-cell flex flex-col justify-between gap-3">
          <div className="icon-badge bg-amber-soft">
            <Flag className="text-amber w-[18px] h-[18px]" />
          </div>
          <div>
            <div className="text-2xl font-extrabold tabular">{reports?.total ?? "–"}</div>
            <div className="text-[12px] text-muted">Laporan menunggu</div>
          </div>
        </div>
      </div>

      {/* FR item 7: ringkasan status eskalasi (pending/ditindaklanjuti/selesai) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <Link href="/eskalasi?status=PENDING" className="bento-cell flex items-center justify-between hover:border-amber transition-colors">
          <div>
            <div className="text-2xl font-extrabold tabular">{escalationStats?.PENDING ?? "–"}</div>
            <div className="text-[12px] text-muted">Eskalasi pending</div>
          </div>
          <div className="icon-badge bg-amber-soft">
            <Siren className="text-amber w-[18px] h-[18px]" />
          </div>
        </Link>
        <Link href="/eskalasi?status=DITINDAKLANJUTI" className="bento-cell flex items-center justify-between hover:border-primary transition-colors">
          <div>
            <div className="text-2xl font-extrabold tabular">{escalationStats?.DITINDAKLANJUTI ?? "–"}</div>
            <div className="text-[12px] text-muted">Ditindaklanjuti</div>
          </div>
          <div className="icon-badge bg-primary-soft">
            <Siren className="text-primary w-[18px] h-[18px]" />
          </div>
        </Link>
        <Link href="/eskalasi?status=SELESAI" className="bento-cell flex items-center justify-between hover:border-safe transition-colors">
          <div>
            <div className="text-2xl font-extrabold tabular">{escalationStats?.SELESAI ?? "–"}</div>
            <div className="text-[12px] text-muted">Selesai</div>
          </div>
          <div className="icon-badge bg-canvas">
            <Siren className="text-safe w-[18px] h-[18px]" />
          </div>
        </Link>
      </div>

      {/* Detail: deteksi terbaru di kiri (lebih luas), ringkasan aksi cepat di kanan.
          Satu kolom penuh di mobile/tablet (setiap kartu punya tinggi wajar sendiri);
          grid 4-kolom + baris tetap 108px hanya berlaku mulai desktop (lg). */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:auto-rows-[108px]">
        <div className="bento-cell lg:col-span-2 lg:row-span-2 min-h-[260px] lg:min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-[14px]">Deteksi Terbaru</span>
            <Link href="/deteksi" className="text-[12.5px] font-semibold text-primary hover:underline">
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

        <div className="bento-cell lg:col-span-2 lg:row-span-2 min-h-[220px] lg:min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-[14px]">Tren Deteksi</span>
            <span className="text-[11.5px] text-muted">7 hari terakhir</span>
          </div>
          <div className="flex-1 flex items-center">
            <DetectionsTrendChart trend={stats?.trend} />
          </div>
        </div>

        <Link
          href="/eskalasi"
          className="bento-cell lg:col-span-2 lg:row-span-2 flex flex-col items-start justify-between gap-3 hover:border-coral transition-colors"
        >
          <Siren className="text-coral w-6 h-6" />
          <div>
            <div className="font-bold text-[14px]">Eskalasi</div>
            <div className="text-[12px] text-muted">Kelola kasus yang ditindaklanjuti</div>
          </div>
        </Link>

        {/* row-span-2 (not 1) — the donut+legend below needs real vertical room (~169px with
            this card's padding/header subtracted); at row-span-1 it was taller than the whole
            card and visibly overflowed past the card's bottom edge. */}
        <div className="bento-cell lg:col-span-2 lg:row-span-2 min-h-[160px] lg:min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-[14px]">Distribusi Status Deteksi</span>
            <Badge tone="primary">{user?.role}</Badge>
          </div>
          <div className="flex-1 flex items-center">
            <DetectionStatusChart statusBreakdown={stats?.statusBreakdown} />
          </div>
        </div>
      </div>
    </div>
  );
}
