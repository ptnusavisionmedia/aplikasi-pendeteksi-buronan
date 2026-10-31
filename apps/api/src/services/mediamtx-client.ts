import { env } from "../env";

/**
 * Registers (or updates) a MediaMTX path that pulls a feed's RTSP source
 * on-demand and republishes it as HLS for the dashboard's focus-mode player.
 * MediaMTX returns 400 on /add if the path already exists (e.g. urlStream
 * changed since the last focus-mode open), so we fall back to /patch.
 */
export async function ensureLivePath(feedId: string, rtspUrl: string): Promise<void> {
  // MediaMTX validates its *entire* path config whenever any path is added/patched, not just the
  // one being touched — so one feed with a malformed source URL (e.g. an unfilled "{host}"
  // template placeholder saved before stricter validation existed on the create/update routes)
  // makes every add/patch call fail with MediaMTX's validation error, for every other feed too,
  // on every periodic health-check cycle. Reject it here, before it ever reaches MediaMTX, so a
  // single bad feed can never poison live view/detection for the rest of the system.
  if (/[{}]/.test(rtspUrl)) {
    throw new Error(
      `URL stream feed ${feedId} tidak valid — mengandung tanda kurung kurawal { } (placeholder yang belum diganti)`
    );
  }

  const headers = { "Content-Type": "application/json" };
  const body = JSON.stringify({ source: rtspUrl, sourceOnDemand: true });
  // Without a bound here, a MediaMTX instance that's slow/wedged (e.g. still validating its
  // whole path config from a previous call) hangs this fetch forever — and every caller of
  // ensureLivePath (the CCTV list's auto "Cek Koneksi", Mode Fokus open) hangs right along with
  // it, with no error ever surfacing to the dashboard.
  const signal = AbortSignal.timeout(8000);

  let addRes: Response;
  try {
    addRes = await fetch(`${env.mediamtx.apiUrl}/v3/config/paths/add/${encodeURIComponent(feedId)}`, {
      method: "POST",
      headers,
      body,
      signal,
    });
  } catch (err) {
    throw new Error(`Gagal menghubungi MediaMTX — tidak merespons dalam 8 detik (${err instanceof Error ? err.message : err})`);
  }
  if (addRes.ok) return;

  if (addRes.status === 400) {
    let patchRes: Response;
    try {
      patchRes = await fetch(`${env.mediamtx.apiUrl}/v3/config/paths/patch/${encodeURIComponent(feedId)}`, {
        method: "PATCH",
        headers,
        body,
        signal: AbortSignal.timeout(8000),
      });
    } catch (err) {
      throw new Error(`Gagal menghubungi MediaMTX — tidak merespons dalam 8 detik (${err instanceof Error ? err.message : err})`);
    }
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
