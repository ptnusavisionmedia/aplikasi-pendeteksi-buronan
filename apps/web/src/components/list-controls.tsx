"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";

export function SearchBar({
  value,
  onChange,
  placeholder = "Cari...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative flex-1 max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-canvas border border-line rounded-xl pl-9 pr-3.5 py-2.5 text-[13.5px] outline-none focus:border-primary transition-colors"
      />
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 text-[12.5px]">
      <span className="text-muted">{total} total</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="icon-badge bg-canvas w-8 h-8 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-line transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-semibold tabular px-1">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="icon-badge bg-canvas w-8 h-8 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-line transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
