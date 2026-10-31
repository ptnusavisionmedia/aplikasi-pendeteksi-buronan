import { env } from "../env";

async function callDetectionEngine<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${env.detectionEngineUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Api-Key": env.detectionEngineApiKey,
      },
      body: JSON.stringify(body),
      // Generous, but bounded — detection-engine's own check_feed() guarantees a reply within
      // its internal 12s timeout, so this only ever trips if detection-engine itself is down or
      // wedged, in which case callers (e.g. the CCTV list's auto "Cek Koneksi") should get an
      // actual error back instead of hanging indefinitely.
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    throw new Error(
      `Tidak bisa menghubungi detection engine — tidak merespons dalam 20 detik (${err instanceof Error ? err.message : err})`
    );
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Detection engine error (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

export interface EnrollResult {
  qdrantPointId: string;
}

export function enrollFace(params: { buronanId: string; fotoUrl: string }) {
  return callDetectionEngine<EnrollResult>("/internal/enroll", params);
}

export interface DetectCandidate {
  buronanId: string;
  confidence: number;
}

export interface DetectResult {
  candidates: DetectCandidate[];
}

export function detectFace(params: { imageUrl: string }) {
  return callDetectionEngine<DetectResult>("/internal/detect", params);
}

export function deleteEmbeddings(pointIds: string[]) {
  if (pointIds.length === 0) return Promise.resolve({ ok: true as const });
  return callDetectionEngine<{ ok: boolean }>("/internal/embeddings/delete", { pointIds });
}

export function startCctvFeed(feedId: string, rtspUrl: string) {
  return callDetectionEngine<{ ok: boolean }>(`/internal/cctv-feeds/${feedId}/start`, { rtspUrl });
}

export function stopCctvFeed(feedId: string) {
  return callDetectionEngine<{ ok: boolean }>(`/internal/cctv-feeds/${feedId}/stop`, {});
}

export interface CctvCheckResult {
  ok: boolean;
  width?: number;
  height?: number;
  fps?: number;
  error?: string;
  snapshotBase64?: string;
}

export function checkCctvFeed(rtspUrl: string) {
  return callDetectionEngine<CctvCheckResult>("/internal/cctv-feeds/check", { rtspUrl });
}

export interface DetectedFace {
  bbox: [number, number, number, number];
  confidence: number;
  buronanId?: string;
  ageSeconds: number;
}

export interface LiveDetectionResult {
  active: boolean;
  faces: DetectedFace[];
}

export function getLiveDetection(feedId: string) {
  return callDetectionEngine<LiveDetectionResult>(`/internal/cctv-feeds/${feedId}/live-detection`, {});
}
