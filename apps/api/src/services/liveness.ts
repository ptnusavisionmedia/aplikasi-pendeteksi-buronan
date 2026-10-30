/**
 * FR-20: Anti-spoofing / liveness gate.
 *
 * The real texture/depth model lives in the Python detection engine (services/detection-engine),
 * which is expected to report `isLive` on every webhook call once that model ships. Until then
 * this module provides the API-side contract + a conservative fallback so the confirmation gate
 * in FR-19 never depends on an engine that hasn't sent a liveness verdict yet.
 */
export interface LivenessSignal {
  /** Verdict reported by the detection engine, if it already runs a liveness model. */
  isLive?: boolean;
  /** 0-1, lower = more likely a flat/printed photo rather than a live face. */
  textureScore?: number;
  /** True when the engine flags the frame as a screen/print recapture. */
  isRecapture?: boolean;
}

const TEXTURE_SCORE_THRESHOLD = 0.4;

/**
 * Returns false only when there is positive evidence of spoofing. A frame with no liveness
 * signal at all (engine hasn't integrated the model yet) is treated as live, matching current
 * production behavior — this keeps the gate additive, never a silent regression.
 */
export function assessLiveness(signal: LivenessSignal): boolean {
  if (signal.isRecapture) return false;
  if (typeof signal.isLive === "boolean") return signal.isLive;
  if (typeof signal.textureScore === "number") return signal.textureScore >= TEXTURE_SCORE_THRESHOLD;
  return true;
}
