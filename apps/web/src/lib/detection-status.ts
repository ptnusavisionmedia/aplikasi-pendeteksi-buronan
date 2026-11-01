import type { DetectionStatus } from "@/lib/types";

const DETECTION_STATUS_META: Record<DetectionStatus, { label: string; tone: "coral" | "amber" | "primary" | "muted" }> = {
  CONFIRMED: { label: "Terkonfirmasi", tone: "coral" },
  CONFIRMED_BY_OFFICER: { label: "Terkonfirmasi", tone: "coral" },
  LOW_CONFIDENCE: { label: "Kemiripan Rendah", tone: "primary" },
  MANUAL_CHECK: { label: "Perlu Cek Manual", tone: "amber" },
  PENDING_CONFIRMATION: { label: "Menunggu Konfirmasi", tone: "amber" },
  REJECTED_FALSE_POSITIVE: { label: "Ditolak", tone: "muted" },
};

export function detectionStatusMeta(status: DetectionStatus) {
  return DETECTION_STATUS_META[status] ?? { label: status, tone: "muted" as const };
}
