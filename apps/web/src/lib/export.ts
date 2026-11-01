import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportToCsv(filename: string, headers: string[], rows: unknown[][]) {
  const lines = [headers.map(csvEscape).join(","), ...rows.map((row) => row.map(csvEscape).join(","))];
  // BOM so Excel on Windows doesn't mangle non-ASCII (nama buronan dsb.) as Latin-1.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, filename);
}

export function exportToPdf(title: string, filename: string, headers: string[], rows: unknown[][]) {
  const doc = new jsPDF({ orientation: rows.length && headers.length > 5 ? "landscape" : "portrait" });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Diekspor ${new Date().toLocaleString("id-ID")}`, 14, 22);
  autoTable(doc, {
    startY: 27,
    head: [headers],
    body: rows.map((row) => row.map((v) => (v === null || v === undefined ? "" : String(v)))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(filename);
}
