"use client";

import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";

export interface DetectedFace {
  bbox: [number, number, number, number];
  confidence: number;
  ageSeconds: number;
  // Rule-based dwell-time flag (not ML, no auto-escalation) — seconds this face has lingered
  // roughly in the same spot, once that crosses the engine's loitering threshold.
  loiterSeconds?: number | null;
}

interface LiveDetectionResponse {
  active: boolean;
  faces: DetectedFace[];
}

const STALE_DETECTION_SECONDS = 8; // a couple missed capture ticks (~2s each) — camera loop likely stopped

/** Polls GET /cctv-feeds/:id/live-detection at `pollIntervalMs` and returns the current faces,
 * clearing them once the result goes stale (feed stopped responding) instead of leaving a boxed
 * face frozen on screen forever. Shared between Mode Fokus and the CCTV list's live card overlay
 * so both read the exact same detection state the same way. */
export function useLiveDetection(feedId: string, active: boolean, pollIntervalMs = 1200): DetectedFace[] {
  const [faces, setFaces] = useState<DetectedFace[]>([]);

  useEffect(() => {
    if (!active) {
      setFaces([]);
      return;
    }
    let cancelled = false;

    async function poll() {
      try {
        const { data } = await apiClient.get<LiveDetectionResponse>(`/cctv-feeds/${feedId}/live-detection`);
        if (cancelled) return;
        const freshFaces = data.active ? data.faces.filter((f) => f.ageSeconds <= STALE_DETECTION_SECONDS) : [];
        setFaces(freshFaces);
      } catch {
        if (!cancelled) setFaces([]);
      }
    }

    poll();
    const interval = setInterval(poll, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [feedId, active, pollIntervalMs]);

  return faces;
}
