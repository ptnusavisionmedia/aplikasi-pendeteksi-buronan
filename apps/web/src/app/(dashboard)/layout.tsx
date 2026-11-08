"use client";

import { useEffect, useState } from "react";
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
  Settings2,
  Menu,
  Newspaper,
  ArrowLeft,
  X,
  Users,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { GlobalSearch } from "@/components/global-search";
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
  { href: "/berita-acara", label: "Berita Acara", icon: Newspaper, roles: ["ADMIN", "APARAT", "KEAMANAN_SWASTA"] },
  { href: "/pengguna", label: "Pengguna", icon: Users, roles: ["ADMIN"] },
  { href: "/pengaturan", label: "Pengaturan", icon: Settings2 },
];

function SidebarContent({
  visibleNav,
  pathname,
  user,
  onNavigate,
  onLogout,
}: {
  visibleNav: NavItem[];
  pathname: string;
  user: { nama: string; wilayahScope: string | null; role: Role };
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2.5 px-1 mb-8">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white shrink-0">
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
              onClick={onNavigate}
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
        <button onClick={onLogout} className="mt-3 flex items-center gap-1.5 text-coral font-semibold hover:underline">
          <LogOut className="w-3.5 h-3.5" /> Keluar
        </button>
      </div>
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, logout, hydrate, hydrated } = useAuthStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && (!token || !user)) router.replace("/login");
  }, [hydrated, token, user, router]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  if (!hydrated || !token || !user) return null;

  const visibleNav = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role));
  const initials = user.nama
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function onLogout() {
    logout();
    router.push("/login");
  }

  return (
    <div className="min-h-screen lg:flex">
      <aside className="glass hidden lg:flex w-[232px] shrink-0 p-5 flex-col rounded-none">
        <SidebarContent visibleNav={visibleNav} pathname={pathname} user={user} onLogout={onLogout} />
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Tutup menu"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <aside className="glass relative w-[260px] max-w-[80vw] h-full p-5 flex flex-col rounded-none">
            <button
              onClick={() => setMobileNavOpen(false)}
              aria-label="Tutup menu"
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center text-muted"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent
              visibleNav={visibleNav}
              pathname={pathname}
              user={user}
              onNavigate={() => setMobileNavOpen(false)}
              onLogout={onLogout}
            />
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0">
        <header className="glass-strong h-16 rounded-none flex items-center justify-between gap-3 px-4 sm:px-5 lg:px-7">
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Buka menu"
            className="w-9 h-9 shrink-0 rounded-xl bg-canvas flex items-center justify-center text-muted hover:text-ink lg:hidden"
          >
            <Menu className="w-[18px] h-[18px]" />
          </button>
          {pathname !== "/dashboard" && (
            <button
              onClick={() => router.back()}
              aria-label="Kembali"
              className="flex items-center gap-1.5 shrink-0 h-9 px-3 rounded-xl bg-canvas text-muted hover:text-ink text-[12.5px] font-semibold transition-colors"
            >
              <ArrowLeft className="w-[16px] h-[16px]" /> <span className="hidden sm:inline">Kembali</span>
            </button>
          )}
          <GlobalSearch />
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link href="/notifikasi" className="w-9 h-9 rounded-xl bg-canvas flex items-center justify-center text-muted hover:text-ink">
              <Bell className="w-[18px] h-[18px]" />
            </Link>
            <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-[12px] font-bold shrink-0">
              {initials}
            </div>
          </div>
        </header>
        <div className="p-4 sm:p-5 lg:p-7">{children}</div>
      </main>
    </div>
  );
}
