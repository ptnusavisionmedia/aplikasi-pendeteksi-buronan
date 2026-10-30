"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DetectionEvent } from "@/lib/types";

const STATUS_META: Record<string, { label: string; color: string }> = {
  CONFIRMED: { label: "Terkonfirmasi", color: "var(--color-coral)" },
  CONFIRMED_BY_OFFICER: { label: "Terkonfirmasi", color: "var(--color-coral)" },
  PENDING_CONFIRMATION: { label: "Menunggu konfirmasi", color: "var(--color-amber)" },
  MANUAL_CHECK: { label: "Perlu cek manual", color: "var(--color-amber)" },
  LOW_CONFIDENCE: { label: "Kemiripan rendah", color: "var(--color-safe)" },
  REJECTED_FALSE_POSITIVE: { label: "Ditolak", color: "var(--color-muted)" },
};

function fallbackMeta(status: string) {
  return { label: status, color: "var(--color-muted)" };
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: { label: string; value: number } }[] }) {
  if (!active || !payload?.length) return null;
  const { label, value } = payload[0].payload;
  return (
    <div className="bg-ink text-white text-[11.5px] font-semibold rounded-lg px-2.5 py-1.5 shadow-pop">
      {label}: {value}
    </div>
  );
}

/** Distribusi status deteksi (terkonfirmasi/menunggu/rendah/ditolak), donut chart via Recharts. */
export function DetectionStatusChart({ detections }: { detections: DetectionEvent[] | undefined }) {
  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of detections ?? []) {
      counts.set(d.status, (counts.get(d.status) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([status, value]) => {
      const meta = STATUS_META[status] ?? fallbackMeta(status);
      return { status, value, label: meta.label, color: meta.color };
    });
  }, [detections]);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return <p className="text-[12.5px] text-muted">Belum ada deteksi untuk ditampilkan.</p>;
  }

  return (
    <div className="flex items-center gap-4 h-full">
      <div className="w-[108px] h-[108px] shrink-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius={32} outerRadius={50} paddingAngle={2} stroke="none">
              {data.map((entry) => (
                <Cell key={entry.status} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[17px] font-extrabold tabular leading-none">{total}</span>
          <span className="text-[9.5px] text-muted font-semibold mt-0.5">total</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        {data.map((entry) => (
          <div key={entry.status} className="flex items-center gap-1.5 text-[11.5px]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
            <span className="text-muted truncate flex-1">{entry.label}</span>
            <span className="font-bold tabular">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
