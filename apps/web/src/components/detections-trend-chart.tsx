"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DetectionEvent } from "@/lib/types";

const DAY_LABEL = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function lastNDays(n: number): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
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

/** Tren deteksi 7 hari terakhir, dirender lewat Recharts. */
export function DetectionsTrendChart({ detections }: { detections: DetectionEvent[] | undefined }) {
  const days = useMemo(() => lastNDays(7), []);
  const data = useMemo(
    () =>
      days.map((day) => {
        const next = new Date(day);
        next.setDate(next.getDate() + 1);
        const count = (detections ?? []).filter((d) => {
          const t = new Date(d.detectedAt).getTime();
          return t >= day.getTime() && t < next.getTime();
        }).length;
        return { label: DAY_LABEL[day.getDay()], count };
      }),
    [days, detections]
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
