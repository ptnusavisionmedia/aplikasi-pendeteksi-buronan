"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { Select, Badge } from "@/components/form";
import { SearchBar, Pagination } from "@/components/list-controls";
import type { PaginatedResult, Role, User } from "@/lib/types";

const ROLE_FILTERS: { value: Role | "ALL"; label: string }[] = [
  { value: "ALL", label: "Semua Role" },
  { value: "ADMIN", label: "Admin" },
  { value: "APARAT", label: "Aparat" },
  { value: "KEAMANAN_SWASTA", label: "Keamanan Swasta" },
  { value: "INSTANSI_HUKUM", label: "Instansi Hukum" },
  { value: "MASYARAKAT", label: "Masyarakat" },
];

const ROLE_BADGE_TONE: Record<Role, "primary" | "coral" | "amber" | "muted"> = {
  ADMIN: "coral",
  APARAT: "primary",
  KEAMANAN_SWASTA: "primary",
  INSTANSI_HUKUM: "amber",
  MASYARAKAT: "muted",
};

export default function PenggunaPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "ADMIN";
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", { roleFilter, q, page }],
    queryFn: async () =>
      (
        await apiClient.get<PaginatedResult<User>>("/admin/users", {
          params: { role: roleFilter === "ALL" ? undefined : roleFilter, q: q || undefined, page, limit: 20 },
        })
      ).data,
    enabled: isAdmin,
  });
  const users = data?.items ?? [];

  if (!isAdmin) {
    return (
      <div className="bento-cell p-6 text-[13px] text-muted">
        Hanya admin yang dapat melihat daftar seluruh akun.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <div className="icon-badge bg-primary-soft text-primary">
          <Users className="w-[18px] h-[18px]" />
        </div>
        <h1 className="text-[22px] font-extrabold tracking-tight">Pengguna</h1>
      </div>
      <p className="text-muted text-[13px] mb-4">{data?.total ?? 0} akun terdaftar di seluruh role.</p>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <SearchBar value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Cari nama atau email..." />
        <Select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value as Role | "ALL"); setPage(1); }}
          className="w-[200px]"
        >
          {ROLE_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="bento-cell overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-muted border-b border-line">
              <th className="px-4 py-3 font-semibold">Nama</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Wilayah</th>
              <th className="px-4 py-3 font-semibold">Terverifikasi</th>
              <th className="px-4 py-3 font-semibold">Dibuat</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  Memuat...
                </td>
              </tr>
            )}
            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  Tidak ada akun yang cocok.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-semibold">{u.nama}</td>
                <td className="px-4 py-3 text-muted">{u.email}</td>
                <td className="px-4 py-3">
                  <Badge tone={ROLE_BADGE_TONE[u.role]}>{u.role}</Badge>
                </td>
                <td className="px-4 py-3 text-muted">{u.wilayahScope ?? "-"}</td>
                <td className="px-4 py-3">{u.isVerified ? "Ya" : "Belum"}</td>
                <td className="px-4 py-3 text-muted">
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString("id-ID") : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} onPageChange={setPage} />
    </div>
  );
}
