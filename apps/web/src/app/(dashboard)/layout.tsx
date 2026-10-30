"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  ShieldAlert,
  LayoutGrid,
  UserSearch,
  Camera,
  ScanFace,
  Flag,
  Bell,
  Siren,
  LogOut,
  Search,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import type { Role } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/buronan", label: "Database Buronan", icon: UserSearch },
  { href: "/cctv", label: "CCTV", icon: Camera },
  { href: "/deteksi", label: "Deteksi", icon: ScanFace },
  { href: "/notifikasi", label: "Notifikasi", icon: Bell },
  { href: "/eskalasi", label: "Eskalasi", icon: Siren, roles: ["ADMIN", "APARAT", "KEAMANAN_SWASTA"] },
  { href: "/laporan", label: "Laporan Masyarakat", icon: Flag, roles: ["ADMIN", "APARAT", "KEAMANAN_SWASTA"] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, logout, hydrate, hydrated } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && (!token || !user)) router.replace("/login");
  }, [hydrated, token, user, router]);

  if (!hydrated || !token || !user) return null;

  const visibleNav = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role));
  const initials = user.nama
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen flex">
      <aside className="glass w-[232px] shrink-0 p-5 flex flex-col rounded-none">
        <div className="flex items-center gap-2.5 px-1 mb-8">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white">
            <ShieldAlert className="w-[18px] h-[18px]" />
          </div>
          <span className="font-extrabold text-[15px] tracking-tight">Sigap Buronan</span>
        </div>
        <nav className="flex flex-col gap-1 text-[13.5px]">
          {visibleNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "glass-primary flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-primary-ink font-semibold"
                    : "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-muted hover:bg-canvas/60"
                }
              >
                <Icon className="w-[18px] h-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto pt-5 border-t border-line text-[12px] text-muted">
          <div className="font-semibold text-ink">{user.nama}</div>
          <div>{user.wilayahScope ?? user.role}</div>
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="mt-3 flex items-center gap-1.5 text-coral font-semibold hover:underline"
          >
            <LogOut className="w-3.5 h-3.5" /> Keluar
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="glass-strong h-16 rounded-none flex items-center justify-between px-7">
          <div className="flex items-center gap-2 text-muted text-[13px] bg-canvas/70 rounded-xl px-3 py-2 w-[320px]">
            <Search className="w-4 h-4" />
            <span>Cari buronan, kamera, kasus...</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/notifikasi" className="w-9 h-9 rounded-xl bg-canvas flex items-center justify-center text-muted hover:text-ink">
              <Bell className="w-[18px] h-[18px]" />
            </Link>
            <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-[12px] font-bold">
              {initials}
            </div>
          </div>
        </header>
        <div className="p-7">{children}</div>
      </main>
    </div>
  );
}
