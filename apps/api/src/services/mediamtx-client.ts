import { env } from "../env";

/**
 * Registers (or updates) a MediaMTX path that pulls a feed's RTSP source
 * on-demand and republishes it as HLS for the dashboard's focus-mode player.
 * MediaMTX returns 400 on /add if the path already exists (e.g. urlStream
 * changed since the last focus-mode open), so we fall back to /patch.
 */
export async function ensureLivePath(feedId: string, rtspUrl: string): Promise<void> {
  const headers = { "Content-Type": "application/json" };
  const body = JSON.stringify({ source: rtspUrl, sourceOnDemand: true });

  const addRes = await fetch(`${env.mediamtx.apiUrl}/v3/config/paths/add/${encodeURIComponent(feedId)}`, {
    method: "POST",
    headers,
    body,
  });
  if (addRes.ok) return;

  if (addRes.status === 400) {
    const patchRes = await fetch(`${env.mediamtx.apiUrl}/v3/config/paths/patch/${encodeURIComponent(feedId)}`, {
      method: "PATCH",
      headers,
      body,
    });
    if (patchRes.ok) return;
    throw new Error(`MediaMTX patch path error (${patchRes.status}): ${await patchRes.text()}`);
  }

  throw new Error(`MediaMTX add path error (${addRes.status}): ${await addRes.text()}`);
}

export function liveHlsUrl(feedId: string): string {
  return `${env.mediamtx.hlsBaseUrl}/${feedId}/index.m3u8`;
}

/** The feed's stream re-published by MediaMTX, for the detection-engine capture loop to read
 * instead of connecting to the camera directly (see env.mediamtx.rtspUrl). */
export function liveRtspUrl(feedId: string): string {
  return `${env.mediamtx.rtspUrl}/${feedId}`;
}
