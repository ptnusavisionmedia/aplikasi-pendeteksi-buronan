/** FR-22: per-camera accuracy metric derived from officer confirm/reject decisions (FR-19). */

/** Flag a camera above this false-positive rate for review, per PRD v2 §Modul 6 FR-22. */
export const FALSE_POSITIVE_RATE_ALERT_THRESHOLD = 0.1;
/** Below this many reviewed matches, the rate is too noisy to act on. */
export const MIN_SAMPLE_SIZE_FOR_ALERT = 5;

export interface CameraAccuracyInput {
  confirmedCount: number;
  rejectedCount: number;
  /** Mean confidenceScore across this camera's REJECTED_FALSE_POSITIVE events, if any —
   * used only to phrase an advisory calibration suggestion, never to change behavior itself. */
  avgRejectedConfidence?: number | null;
  /** This camera's currently-effective match threshold (SystemSetting.detectionMatchThreshold,
   * since per-camera thresholds don't exist), for phrasing "raise it to X" concretely. */
  currentMatchThreshold?: number;
}

export interface CameraAccuracyResult {
  totalReviewed: number;
  falsePositiveRate: number;
  flagged: boolean;
  /** Advisory-only text for the dashboard to show an admin, never applied automatically — a
   * public-safety detection threshold should always be a human decision (see
   * vault/04-Research/2026-10-31 - Rencana Kecerdasan Buatan Tambahan). Null unless there's a
   * concrete, statistically-grounded suggestion to make. */
  calibrationSuggestion: string | null;
}

export function computeCameraAccuracy({
  confirmedCount,
  rejectedCount,
  avgRejectedConfidence,
  currentMatchThreshold,
}: CameraAccuracyInput): CameraAccuracyResult {
  const totalReviewed = confirmedCount + rejectedCount;
  const falsePositiveRate = totalReviewed === 0 ? 0 : rejectedCount / totalReviewed;
  const flagged =
    totalReviewed >= MIN_SAMPLE_SIZE_FOR_ALERT && falsePositiveRate > FALSE_POSITIVE_RATE_ALERT_THRESHOLD;

  let calibrationSuggestion: string | null = null;
  if (
    flagged &&
    avgRejectedConfidence != null &&
    currentMatchThreshold != null &&
    avgRejectedConfidence > currentMatchThreshold
  ) {
    const suggested = Math.min(0.99, Math.round((avgRejectedConfidence + 0.03) * 100) / 100);
    calibrationSuggestion =
      `Kamera ini punya tingkat false-positive ${(falsePositiveRate * 100).toFixed(0)}% dari ${totalReviewed} tinjauan ` +
      `(ambang saat ini ${(currentMatchThreshold * 100).toFixed(0)}%). Rata-rata skor kecocokan yang DITOLAK petugas di kamera ini ` +
      `adalah ${(avgRejectedConfidence * 100).toFixed(0)}% — pertimbangkan menaikkan ambang kecocokan terkonfirmasi ke sekitar ` +
      `${(suggested * 100).toFixed(0)}% di halaman Pengaturan. Ini hanya saran berdasarkan statistik; keputusan tetap di tangan admin.`;
  }

  return { totalReviewed, falsePositiveRate, flagged, calibrationSuggestion };
}
