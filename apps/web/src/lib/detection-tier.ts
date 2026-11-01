/** Shared between Mode Fokus and the CCTV list's live card overlay — same cutoffs the backend
 * uses to decide whether to auto-capture a match (SystemSetting.detectionMatchThreshold /
 * detectionReportThreshold, see apps/api/src/routes/detections.ts getConfidenceThreshold()). */
export interface DetectionTier {
  color: string;
  soft: string;
  label: string;
}

export function tierFor(confidence: number, reportThreshold: number, matchThreshold: number): DetectionTier {
  if (confidence >= matchThreshold) return { color: "var(--color-coral)", soft: "var(--color-coral-soft)", label: "COCOK TINGGI" };
  if (confidence >= reportThreshold) return { color: "var(--color-amber)", soft: "var(--color-amber-soft)", label: "MIRIP" };
  return { color: "var(--color-safe)", soft: "var(--color-safe-soft)", label: "RENDAH" };
}
