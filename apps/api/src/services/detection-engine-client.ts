import { env } from "../env";

async function callDetectionEngine<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${env.detectionEngineUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Api-Key": env.detectionEngineApiKey,
    },
    body: JSON.stringify(body),
  });

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

export interface LiveDetectionResult {
  active: boolean;
  bbox?: [number, number, number, number];
  confidence?: number;
  buronanId?: string;
  ageSeconds?: number;
}

export function getLiveDetection(feedId: string) {
  return callDetectionEngine<LiveDetectionResult>(`/internal/cctv-feeds/${feedId}/live-detection`, {});
}
