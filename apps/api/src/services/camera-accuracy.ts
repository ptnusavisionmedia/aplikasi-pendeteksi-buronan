/** FR-22: per-camera accuracy metric derived from officer confirm/reject decisions (FR-19). */

/** Flag a camera above this false-positive rate for review, per PRD v2 §Modul 6 FR-22. */
export const FALSE_POSITIVE_RATE_ALERT_THRESHOLD = 0.1;
/** Below this many reviewed matches, the rate is too noisy to act on. */
export const MIN_SAMPLE_SIZE_FOR_ALERT = 5;

export interface CameraAccuracyInput {
  confirmedCount: number;
  rejectedCount: number;
}

export interface CameraAccuracyResult {
  totalReviewed: number;
  falsePositiveRate: number;
  flagged: boolean;
}

export function computeCameraAccuracy({
  confirmedCount,
  rejectedCount,
}: CameraAccuracyInput): CameraAccuracyResult {
  const totalReviewed = confirmedCount + rejectedCount;
  const falsePositiveRate = totalReviewed === 0 ? 0 : rejectedCount / totalReviewed;
  const flagged =
    totalReviewed >= MIN_SAMPLE_SIZE_FOR_ALERT && falsePositiveRate > FALSE_POSITIVE_RATE_ALERT_THRESHOLD;

  return { totalReviewed, falsePositiveRate, flagged };
}
