import crypto from "crypto";
import { Cam } from "onvif";

/**
 * PTZ (pan/tilt/zoom) + snapshot control over ONVIF — a standard most IP camera brands
 * implement (Tapo, Hikvision, Dahua, and most others), so this isn't tied to one vendor's
 * proprietary app/cloud API. ONVIF credentials and host are reused from the feed's RTSP
 * urlStream (same account on nearly every consumer/pro camera); onvifPort is the one thing
 * that varies by brand/model and is stored per-feed (see CAMERA_PRESETS on the web side for
 * sensible per-brand defaults).
 */

export type PtzDirection = "up" | "down" | "left" | "right";

const DIRECTION_VECTOR: Record<PtzDirection, { x: number; y: number }> = {
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export interface PtzFeed {
  urlStream: string;
  onvifPort: number;
}

function parseCredentials(urlStream: string): { hostname: string; username?: string; password?: string } {
  let url: URL;
  try {
    url = new URL(urlStream);
  } catch {
    throw new Error("urlStream kamera tidak valid untuk diurai host/kredensialnya");
  }
  return {
    hostname: url.hostname,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
  };
}

/** Translates the `onvif` package's raw SOAP fault text (e.g. `ONVIF SOAP Fault:
 * {"value":"SOAP-ENV:Receiver","subcode":{"value":"ter:ActionNotSupported"}}`) into something a
 * dashboard user can actually act on, instead of showing them an ONVIF protocol internals dump. */
function friendlyPtzError(err: unknown, action: string): Error {
  const message = err instanceof Error ? err.message : String(err);

  if (/ActionNotSupported/i.test(message)) {
    return new Error(
      `Kamera ini tidak mendukung perintah ONVIF "${action}" — kemungkinan firmware kamera tidak mengimplementasikan fitur ini meski kameranya mendukung ONVIF secara umum.`
    );
  }
  if (/NotAuthorized|Unauthorized|InvalidArgVal.*Credential/i.test(message)) {
    return new Error("Kamera menolak kredensial ONVIF — periksa kembali username/password pada URL stream.");
  }
  if (/ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH/i.test(message)) {
    return new Error("Tidak bisa terhubung ke port ONVIF kamera — periksa kembali Port ONVIF, atau pastikan kamera & server di jaringan yang sama.");
  }
  return new Error(`Gagal menjalankan perintah PTZ "${action}" pada kamera — ${message}`);
}

function connect(feed: PtzFeed): Promise<InstanceType<typeof Cam>> {
  const { hostname, username, password } = parseCredentials(feed.urlStream);
  return new Promise((resolve, reject) => {
    const cam = new Cam(
      { hostname, username, password, port: feed.onvifPort, timeout: 8000 },
      (err: Error | null) => {
        if (err) reject(new Error(`Gagal terhubung ke ONVIF kamera di ${hostname}:${feed.onvifPort} — ${err.message}`));
        else resolve(cam);
      }
    );
  });
}

/** Starts panning/tilting in `direction` at a fixed speed. The camera keeps moving until `ptzStop`
 * is called — same model as a physical joystick button being held down. */
export async function ptzMove(feed: PtzFeed, direction: PtzDirection, speed = 0.5): Promise<void> {
  const cam = await connect(feed);
  const vector = DIRECTION_VECTOR[direction];
  await new Promise<void>((resolve, reject) => {
    cam.continuousMove({ x: vector.x * speed, y: vector.y * speed, zoom: 0 }, (err: Error | null) =>
      err ? reject(friendlyPtzError(err, "gerakkan kamera")) : resolve()
    );
  });
}

export async function ptzStop(feed: PtzFeed): Promise<void> {
  const cam = await connect(feed);
  await new Promise<void>((resolve, reject) => {
    cam.stop({ panTilt: true, zoom: true }, (err: Error | null) =>
      err ? reject(friendlyPtzError(err, "hentikan kamera")) : resolve()
    );
  });
}

/** HTTP Digest auth (RFC 7616, qop=auth) — ONVIF snapshot URIs are almost always behind Digest,
 * not Basic, and `fetch` has no built-in support for it. Does the standard challenge/response
 * round trip: an unauthenticated GET, then a signed retry using the WWW-Authenticate challenge. */
async function digestFetch(url: string, username?: string, password?: string): Promise<Response> {
  const first = await fetch(url);
  if (first.status !== 401 || !username || !password) return first;

  const challenge = first.headers.get("www-authenticate");
  if (!challenge || !/^digest/i.test(challenge)) return first;

  const params = Object.fromEntries(
    [...challenge.matchAll(/(\w+)=(?:"([^"]*)"|([^\s,]+))/g)].map((m) => [m[1], m[2] ?? m[3]])
  );
  const { realm, nonce, qop, opaque } = params;
  const { pathname, search } = new URL(url);
  const uri = pathname + search;

  const ha1 = crypto.createHash("md5").update(`${username}:${realm}:${password}`).digest("hex");
  const ha2 = crypto.createHash("md5").update(`GET:${uri}`).digest("hex");
  const nc = "00000001";
  const cnonce = crypto.randomBytes(8).toString("hex");
  const response = qop
    ? crypto.createHash("md5").update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest("hex")
    : crypto.createHash("md5").update(`${ha1}:${nonce}:${ha2}`).digest("hex");

  const authParts = [
    `Digest username="${username}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
  ];
  if (qop) authParts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  if (opaque) authParts.push(`opaque="${opaque}"`);

  return fetch(url, { headers: { Authorization: authParts.join(", ") } });
}

/** Captures a still photo straight from the camera's own ONVIF snapshot endpoint (sharper than
 * grabbing a frame off the RTSP stream, and doesn't compete with detection-engine/MediaMTX for
 * the camera's RTSP session). */
export async function ptzSnapshot(feed: PtzFeed): Promise<Buffer> {
  const cam = await connect(feed);
  const { uri } = await new Promise<{ uri: string }>((resolve, reject) => {
    cam.getSnapshotUri({}, (err: Error | null, result?: { uri: string }) => {
      if (err) return reject(friendlyPtzError(err, "ambil foto"));
      if (!result) return reject(new Error("Kamera tidak mengembalikan snapshot URI"));
      resolve(result);
    });
  });

  const { username, password } = parseCredentials(feed.urlStream);
  const res = await digestFetch(uri, username, password);
  if (!res.ok) throw new Error(`Gagal mengambil snapshot dari kamera (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
