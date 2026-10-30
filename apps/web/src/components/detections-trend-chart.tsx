"use client";

import { useId, useMemo, useState } from "react";
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

/** Simple hand-rolled bar chart (no chart library needed for one series) — keeps the
 * bundle light and matches the app's own bento/token visual language instead of a
 * generic default theme. */
export function DetectionsTrendChart({ detections }: { detections: DetectionEvent[] | undefined }) {
  const gradientId = useId();
  const [hovered, setHovered] = useState<number | null>(null);

  const days = useMemo(() => lastNDays(7), []);
  const counts = useMemo(() => {
    return days.map((day) => {
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      return (detections ?? []).filter((d) => {
        const t = new Date(d.detectedAt).getTime();
        return t >= day.getTime() && t < next.getTime();
      }).length;
    });
  }, [days, detections]);

  const max = Math.max(1, ...counts);
  const width = 520;
  const height = 140;
  const padLeft = 24;
  const padBottom = 24;
  const chartW = width - padLeft - 8;
  const chartH = height - padBottom - 8;
  const barGap = 10;
  const barW = (chartW - barGap * (counts.length - 1)) / counts.length;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible" role="img" aria-label="Tren deteksi 7 hari terakhir">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((t) => {
          const y = 8 + chartH * (1 - t);
          return (
            <line
              key={t}
              x1={padLeft}
              x2={width}
              y1={y}
              y2={y}
              stroke="var(--color-line)"
              strokeWidth={1}
              strokeDasharray={t === 0 ? undefined : "3 4"}
            />
          );
        })}
        <text x={0} y={8 + chartH * 1 + 4} className="fill-muted" fontSize={10}>
          0
        </text>
        <text x={0} y={8 + chartH * 0 + 4} className="fill-muted" fontSize={10}>
          {max}
        </text>

        {counts.map((count, i) => {
          const barH = (count / max) * chartH;
          const x = padLeft + i * (barW + barGap);
          const y = 8 + chartH - barH;
          const isHovered = hovered === i;
          return (
            <g
              key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
              className="cursor-default"
            >
              <rect x={x} y={8} width={barW} height={chartH} fill="transparent" />
              <rect
                x={x}
                y={count === 0 ? 8 + chartH - 2 : y}
                width={barW}
                height={count === 0 ? 2 : barH}
                rx={6}
                fill={isHovered ? "var(--color-primary)" : `url(#${gradientId})`}
                className="transition-colors"
              />
              {isHovered && (
                <text x={x + barW / 2} y={y - 8 < 12 ? 12 : y - 8} textAnchor="middle" fontSize={11} fontWeight={700} className="fill-ink">
                  {count}
                </text>
              )}
              <text
                x={x + barW / 2}
                y={height - 6}
                textAnchor="middle"
                fontSize={10.5}
                fontWeight={isHovered ? 700 : 500}
                className={isHovered ? "fill-ink" : "fill-muted"}
              >
                {DAY_LABEL[days[i].getDay()]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
