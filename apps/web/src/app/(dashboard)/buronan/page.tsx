"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, UserSearch } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { Badge, Input, Select } from "@/components/form";
import type { Buronan, BuronanStatus } from "@/lib/types";

const STATUS_TONE: Record<BuronanStatus, "coral" | "primary" | "muted"> = {
  DPO_AKTIF: "coral",
  TERTANGKAP: "primary",
  DICABUT: "muted",
};

const STATUS_LABEL: Record<BuronanStatus, string> = {
  DPO_AKTIF: "DPO Aktif",
  TERTANGKAP: "Tertangkap",
  DICABUT: "Dicabut",
};

export default function BuronanListPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === "ADMIN" || user?.role === "INSTANSI_HUKUM";
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["buronan", q, status],
    queryFn: async () =>
      (await apiClient.get<Buronan[]>("/buronan", { params: { q: q || undefined, status: status || undefined } })).data,
  });

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Database Buronan</h1>
          <p className="text-muted text-[13px] mt-1">{data?.length ?? 0} data ditemukan</p>
        </div>
        {canManage && (
          <Link
            href="/buronan/new"
            className="flex items-center gap-2 bg-primary text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl shadow-pop hover:bg-primary-ink transition-colors"
          >
            <Plus className="w-4 h-4" /> Tambah Buronan
          </Link>
        )}
      </div>

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau nomor kasus..." className="pl-10 w-full" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-[180px]">
          <option value="">Semua status</option>
          <option value="DPO_AKTIF">DPO Aktif</option>
          <option value="TERTANGKAP">Tertangkap</option>
          <option value="DICABUT">Dicabut</option>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {isLoading && <p className="text-[13px] text-muted col-span-3">Memuat data...</p>}
        {!isLoading && data?.length === 0 && (
          <div className="bento-cell col-span-3 flex flex-col items-center justify-center py-10 text-muted">
            <UserSearch className="w-6 h-6 mb-2" />
            <p className="text-[13px]">Tidak ada data buronan.</p>
          </div>
        )}
        {data?.map((b) => (
          <Link key={b.id} href={`/buronan/${b.id}`} className="bento-cell flex flex-col gap-3 hover:border-primary transition-colors">
            <div className="w-full aspect-square rounded-xl bg-canvas overflow-hidden flex items-center justify-center text-muted">
              {b.fotos?.[0]?.urlFoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.fotos[0].urlFoto} alt={b.nama} className="w-full h-full object-cover" />
              ) : (
                <UserSearch className="w-8 h-8" />
              )}
            </div>
            <div>
              <div className="font-bold text-[14px] truncate">{b.nama}</div>
              <div className="text-[12px] text-muted">Kasus #{b.nomorKasus}</div>
            </div>
            <div className="flex items-center justify-between">
              <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
              <span className="text-[11.5px] text-muted">{b.tingkatAncaman}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
