"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, UserSearch, Camera, ScanFace, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface SearchResult {
  type: "buronan" | "cctv" | "deteksi";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const TYPE_META: Record<SearchResult["type"], { label: string; icon: typeof UserSearch }> = {
  buronan: { label: "Buronan", icon: UserSearch },
  cctv: { label: "CCTV", icon: Camera },
  deteksi: { label: "Deteksi", icon: ScanFace },
};

/** Sidebar header's search box — previously just decorative placeholder text ("Cari buronan,
 * kamera, kasus...") with no input behind it. Debounces input, queries GET /search, and shows
 * results grouped by category in a dropdown; picking one navigates straight there. */
export function GlobalSearch() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: async () => (await apiClient.get<{ results: SearchResult[] }>("/search", { params: { q: debounced } })).data.results,
    enabled: debounced.length >= 2,
  });

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function goTo(result: SearchResult) {
    router.push(result.href);
    setOpen(false);
    setQuery("");
  }

  const results = data ?? [];
  const showDropdown = open && debounced.length >= 2;

  return (
    <div ref={containerRef} className="relative w-[320px]">
      <div className="flex items-center gap-2 text-muted text-[13px] bg-canvas/70 rounded-xl px-3 py-2">
        {isFetching ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Search className="w-4 h-4 shrink-0" />}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Cari buronan, kamera, kasus..."
          className="bg-transparent outline-none w-full text-ink placeholder:text-muted"
        />
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-line rounded-xl shadow-pop max-h-[360px] overflow-y-auto z-50">
          {results.length === 0 && !isFetching && (
            <p className="text-[12.5px] text-muted px-3.5 py-3">Tidak ada hasil untuk &quot;{debounced}&quot;</p>
          )}
          {results.map((r) => {
            const meta = TYPE_META[r.type];
            const Icon = meta.icon;
            return (
              <button
                key={`${r.type}-${r.id}`}
                type="button"
                onClick={() => goTo(r)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-canvas transition-colors text-left"
              >
                <div className="icon-badge bg-canvas shrink-0">
                  <Icon className="w-4 h-4 text-ink" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate">{r.title}</div>
                  <div className="text-[11.5px] text-muted truncate">{r.subtitle}</div>
                </div>
                <span className="text-[10.5px] font-semibold text-muted shrink-0">{meta.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
