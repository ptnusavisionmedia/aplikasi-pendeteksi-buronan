"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { UserX, ScanFace, Camera, Flag, TrendingUp, Siren } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { Badge } from "@/components/form";
import { DetectionsTrendChart } from "@/components/detections-trend-chart";
import { DetectionStatusChart } from "@/components/detection-status-chart";
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

      {/* Hero: ringkasan total deteksi paling menonjol, baris sendiri di atas */}
      <div className="bento-cell bg-primary text-white flex items-center justify-between gap-6 mb-4">
        <div>
          <span className="text-[12.5px] font-semibold uppercase tracking-wide opacity-80">Total Deteksi Tercatat</span>
          <div className="text-4xl font-extrabold tabular mt-1">{detections?.length ?? "–"}</div>
          <div className="text-[12px] opacity-80 mt-1">{detectionsToday.length} deteksi hari ini</div>
        </div>
        <div className="icon-badge bg-white/15 w-12 h-12">
          <TrendingUp className="w-5 h-5" />
        </div>
      </div>

      {/* Statistik ringkas, selalu dalam satu baris agar mudah di-scan */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bento-cell flex flex-col justify-between gap-3">
          <div className="icon-badge bg-primary-soft">
            <UserX className="text-primary w-[18px] h-[18px]" />
          </div>
          <div>
            <div className="text-2xl font-extrabold tabular">{buronanList?.length ?? "–"}</div>
            <div className="text-[12px] text-muted">DPO Aktif</div>
          </div>
        </div>

        <div className="bento-cell flex flex-col justify-between gap-3">
          <div className="icon-badge bg-coral-soft">
            <ScanFace className="text-coral w-[18px] h-[18px]" />
          </div>
          <div>
            <div className="text-2xl font-extrabold tabular">{detectionsToday.length}</div>
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
            <div className="text-2xl font-extrabold tabular">
              {reports?.filter((r) => r.status === "MENUNGGU_VERIFIKASI").length ?? "–"}
            </div>
            <div className="text-[12px] text-muted">Laporan menunggu</div>
          </div>
        </div>
      </div>

      {/* Detail: deteksi terbaru di kiri (lebih luas), ringkasan aksi cepat di kanan */}
      <div className="grid grid-cols-4 gap-4 auto-rows-[108px]">
        <div className="bento-cell col-span-2 row-span-2 flex flex-col">
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

        <div className="bento-cell col-span-2 row-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-[14px]">Tren Deteksi</span>
            <span className="text-[11.5px] text-muted">7 hari terakhir</span>
          </div>
          <div className="flex-1 flex items-center">
            <DetectionsTrendChart detections={detections} />
          </div>
        </div>

        <Link
          href="/eskalasi"
          className="bento-cell col-span-2 row-span-2 flex flex-col items-start justify-between hover:border-coral transition-colors"
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
        <div className="bento-cell col-span-2 row-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-[14px]">Distribusi Status Deteksi</span>
            <Badge tone="primary">{user?.role}</Badge>
          </div>
          <div className="flex-1 flex items-center">
            <DetectionStatusChart detections={detections} />
          </div>
        </div>
      </div>
    </div>
  );
}
