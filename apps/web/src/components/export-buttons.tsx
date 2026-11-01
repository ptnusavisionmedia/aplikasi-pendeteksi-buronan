"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { exportToCsv, exportToPdf } from "@/lib/export";
import { GhostButton } from "@/components/form";

export function ExportButtons({
  title,
  filenameBase,
  headers,
  rows,
}: {
  title: string;
  filenameBase: string;
  headers: string[];
  rows: unknown[][];
}) {
  return (
    <div className="flex items-center gap-2">
      <GhostButton
        type="button"
        onClick={() => exportToCsv(`${filenameBase}.csv`, headers, rows)}
        disabled={rows.length === 0}
        title="Export CSV"
      >
        <FileSpreadsheet className="w-4 h-4" /> CSV
      </GhostButton>
      <GhostButton
        type="button"
        onClick={() => exportToPdf(title, `${filenameBase}.pdf`, headers, rows)}
        disabled={rows.length === 0}
        title="Export PDF"
      >
        <FileText className="w-4 h-4" /> PDF
      </GhostButton>
    </div>
  );
}
