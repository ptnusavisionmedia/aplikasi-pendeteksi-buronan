"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const DAY_LABEL = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export interface TrendPoint {
  date: string;
  count: number;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: { label: string; count: number } }[] }) {
  if (!active || !payload?.length) return null;
  const { label, count } = payload[0].payload;
  return (
    <div className="bg-ink text-white text-[11.5px] font-semibold rounded-lg px-2.5 py-1.5 shadow-pop">
      {label}: {count} deteksi
    </div>
  );
}

/** Tren deteksi 7 hari terakhir, dirender lewat Recharts. `trend` datang dari GET /detections/stats
 * (dihitung server-side) agar tetap akurat meski /detections sudah dipaginasi. */
export function DetectionsTrendChart({ trend }: { trend: TrendPoint[] | undefined }) {
  const data = useMemo(
    () => (trend ?? []).map((p) => ({ label: DAY_LABEL[new Date(p.date).getDay()], count: p.count })),
    [trend]
  );

  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="detections-trend-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.95} />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.55} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="3 4" />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10.5, fill: "var(--color-muted)", fontWeight: 600 }}
        />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--color-muted)" }} width={28} />
        <Tooltip cursor={{ fill: "var(--color-canvas)" }} content={<ChartTooltip />} />
        <Bar dataKey="count" fill="url(#detections-trend-gradient)" radius={[6, 6, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
