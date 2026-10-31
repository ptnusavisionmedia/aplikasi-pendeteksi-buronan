import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { writeAuditLog } from "../services/audit-log";
import { computeCameraAccuracy } from "../services/camera-accuracy";
import { checkCctvFeed, getLiveDetection, startCctvFeed, stopCctvFeed } from "../services/detection-engine-client";
import { ensureLivePath, liveHlsUrl, liveRtspUrl } from "../services/mediamtx-client";
import { ptzMove, ptzSnapshot, ptzStop, type PtzDirection } from "../services/ptz-client";
import { uploadEvidenceFile } from "../services/storage";
import { env } from "../env";
import { prisma } from "../services/prisma";

export const cctvRouter = Router();

// `.url()` alone accepts strings like "rtsp://{user}:{pass}@{host}:554/stream1" — curly braces
// are valid URL characters per WHATWG parsing, but they're never valid as literal credentials/host,
// almost always a copy-pasted template placeholder the user forgot to fill in. MediaMTX's stricter
// Go URL parser rejects these at stream time (and, since MediaMTX validates its whole path config
// together, one feed with a bad URL like this can break live view/checks for every other feed too)
// — so we reject it up front with a message that points at the actual mistake.
const rtspUrlSchema = z
  .string()
  .url()
  .refine((url) => !/[{}]/.test(url), {
    message: "URL stream mengandung tanda kurung kurawal { } — sepertinya placeholder template belum diganti dengan nilai asli (username/password/IP kamera)",
  });

/**
 * Arms the detection-engine capture loop for a feed via MediaMTX's re-published stream rather
 * than the camera's own URL — see env.mediamtx.rtspUrl for why. Registers the MediaMTX path
 * first so it exists for detection-engine to pull from.
 */
async function startDetection(feedId: string, urlStream: string): Promise<void> {
  await ensureLivePath(feedId, urlStream);
  await startCctvFeed(feedId, liveRtspUrl(feedId));
}

const createFeedSchema = z.object({
  nama: z.string().min(1),
  lokasi: z.string().min(1),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  urlStream: rtspUrlSchema,
  wilayah: z.string().min(1),
  // FR-24: webcam-as-simulated-feed for dev/staging only, never production.
  sourceType: z.enum(["PRODUCTION", "DEV_SIMULATION"]).optional(),
  ptzSupported: z.boolean().optional(),
  onvifPort: z.number().int().min(1).max(65535).optional(),
});

cctvRouter.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "APARAT", "KEAMANAN_SWASTA"),
  async (req, res) => {
    const parsed = createFeedSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    if (parsed.data.sourceType === "DEV_SIMULATION" && env.isProduction) {
      return res.status(403).json({
        error: "Feed simulasi (webcam dev) tidak dapat didaftarkan di environment production",
      });
    }

    const feed = await prisma.cCTVFeed.create({
      data: { ...parsed.data, ownerId: req.user!.id, instansiId: req.user!.instansiId },
    });

    await startDetection(feed.id, feed.urlStream).catch((err) => {
      console.error(`Gagal memulai feed ${feed.id} di detection engine:`, err);
    });

    await writeAuditLog({
      userId: req.user!.id,
      action: "CREATE_CCTV_FEED",
      entityType: "CCTVFeed",
      entityId: feed.id,
    });

    res.status(201).json(feed);
  }
);

cctvRouter.get("/", requireAuth, async (req, res) => {
  const scope = req.user!.role === "ADMIN" ? undefined : req.user!.wilayahScope ?? undefined;
  const feeds = await prisma.cCTVFeed.findMany({
    where: scope ? { wilayah: scope } : undefined,
    orderBy: { createdAt: "desc" },
  });
  res.json(feeds);
});

const updateFeedSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "OFFLINE"]).optional(),
  nama: z.string().min(1).optional(),
  lokasi: z.string().min(1).optional(),
  wilayah: z.string().min(1).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  urlStream: rtspUrlSchema.optional(),
  ptzSupported: z.boolean().optional(),
  onvifPort: z.number().int().min(1).max(65535).optional(),
});

cctvRouter.patch(
  "/:id",
  requireAuth,
  requireRole("ADMIN", "APARAT", "KEAMANAN_SWASTA"),
  async (req, res) => {
    const parsed = updateFeedSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const feed = await prisma.cCTVFeed.update({ where: { id: req.params.id }, data: parsed.data });

    if (parsed.data.status === "INACTIVE" || parsed.data.status === "OFFLINE") {
      await stopCctvFeed(feed.id).catch((err) => console.error(`Gagal stop feed ${feed.id}:`, err));
    } else if (feed.status === "ACTIVE" && (parsed.data.status === "ACTIVE" || parsed.data.urlStream)) {
      // Re-arm the detection-engine capture loop — it only lives in that process's memory, so a
      // feed toggled off and back on (or re-activated after the engine restarted) needs this to
      // actually resume producing detections, not just flip the status badge in the dashboard.
      // Also covers editing the stream URL (e.g. correcting a camera's IP) on an already-active
      // feed — the running capture loop keeps pulling the old URL otherwise.
      await startDetection(feed.id, feed.urlStream).catch((err) => console.error(`Gagal start feed ${feed.id}:`, err));
    }

    await writeAuditLog({
      userId: req.user!.id,
      action: "UPDATE_CCTV_FEED",
      entityType: "CCTVFeed",
      entityId: feed.id,
      detail: parsed.data,
    });

    res.json(feed);
  }
);

cctvRouter.delete(
  "/:id",
  requireAuth,
  requireRole("ADMIN", "APARAT", "KEAMANAN_SWASTA"),
  async (req, res) => {
    const feed = await prisma.cCTVFeed.findUnique({ where: { id: req.params.id } });
    if (!feed) return res.status(404).json({ error: "CCTV feed tidak ditemukan" });

    // Stop the detection-engine capture loop before deleting the row — otherwise the in-memory
    // loop keeps running against a feed id that no longer exists in the database.
    await stopCctvFeed(feed.id).catch((err) => console.error(`Gagal stop feed ${feed.id} sebelum hapus:`, err));

    // detection_events.cctvFeedId is nullable (ON DELETE SET NULL), so past detection history
    // for this camera stays intact, just no longer attributed to a live feed.
    await prisma.cCTVFeed.delete({ where: { id: feed.id } });

    await writeAuditLog({
      userId: req.user!.id,
      action: "DELETE_CCTV_FEED",
      entityType: "CCTVFeed",
      entityId: feed.id,
      detail: { nama: feed.nama, lokasi: feed.lokasi },
    });

    res.status(204).end();
  }
);

/** One-shot connectivity test for the "Cek Koneksi" button — does not start the detection loop. */
cctvRouter.post("/:id/check", requireAuth, async (req, res) => {
  const feed = await prisma.cCTVFeed.findUnique({ where: { id: req.params.id } });
  if (!feed) return res.status(404).json({ error: "CCTV feed tidak ditemukan" });

  try {
    // Go through MediaMTX's relay instead of opening a second direct RTSP session to the camera —
    // this periodic check runs every 30s from the CCTV list page, and a camera like the Tapo C200
    // can't sustain a direct connection from this check *and* Mode Fokus/detection-engine at the
    // same time (same root cause as the bbox-freeze fix in startDetection above). MediaMTX
    // multiplexes everyone onto a single upstream connection to the camera.
    try {
      await ensureLivePath(feed.id, feed.urlStream);
    } catch (err) {
      // A malformed URL (e.g. an unfilled "{host}" placeholder) is rejected before it ever
      // reaches MediaMTX or detection-engine — surface that specific reason instead of a generic
      // "can't reach detection engine", so it's clear this is a feed configuration problem.
      return res.json({ ok: false, error: err instanceof Error ? err.message : "URL stream tidak valid" });
    }
    const result = await checkCctvFeed(liveRtspUrl(feed.id));
    res.json(result);
  } catch (err) {
    console.error(`Gagal cek koneksi feed ${feed.id}:`, err);
    res.status(502).json({ ok: false, error: "Gagal menghubungi detection engine" });
  }
});

/** Mode Fokus: ensure a MediaMTX path exists for this feed and return its HLS playback URL. */
cctvRouter.post("/:id/live", requireAuth, async (req, res) => {
  const feed = await prisma.cCTVFeed.findUnique({ where: { id: req.params.id } });
  if (!feed) return res.status(404).json({ error: "CCTV feed tidak ditemukan" });

  try {
    await ensureLivePath(feed.id, feed.urlStream);
    res.json({ hlsUrl: liveHlsUrl(feed.id) });
  } catch (err) {
    console.error(`Gagal menyiapkan live path feed ${feed.id}:`, err);
    const message = err instanceof Error && /tidak valid/.test(err.message) ? err.message : "Gagal menyiapkan live stream";
    res.status(502).json({ error: message });
  }
});

/** Mode Fokus: polled ~1x/sec to draw the live confidence bounding box over the video. */
cctvRouter.get("/:id/live-detection", requireAuth, async (req, res) => {
  const feed = await prisma.cCTVFeed.findUnique({ where: { id: req.params.id } });
  if (!feed) return res.status(404).json({ error: "CCTV feed tidak ditemukan" });

  try {
    const result = await getLiveDetection(feed.id);
    res.json(result);
  } catch (err) {
    console.error(`Gagal ambil live detection feed ${feed.id}:`, err);
    res.status(502).json({ active: false });
  }
});

/** FR-22: rolling false-positive rate for this camera, derived from officer confirm/reject decisions. */
cctvRouter.get("/:id/accuracy", requireAuth, async (req, res) => {
  const feed = await prisma.cCTVFeed.findUnique({ where: { id: req.params.id } });
  if (!feed) return res.status(404).json({ error: "CCTV feed tidak ditemukan" });

  const [confirmedCount, rejectedCount] = await Promise.all([
    prisma.detectionEvent.count({ where: { cctvFeedId: feed.id, status: "CONFIRMED_BY_OFFICER" } }),
    prisma.detectionEvent.count({ where: { cctvFeedId: feed.id, status: "REJECTED_FALSE_POSITIVE" } }),
  ]);

  res.json(computeCameraAccuracy({ confirmedCount, rejectedCount }));
});

const ptzMoveSchema = z.object({ direction: z.enum(["up", "down", "left", "right"]) });

async function requirePtzFeed(id: string, res: import("express").Response) {
  const feed = await prisma.cCTVFeed.findUnique({ where: { id } });
  if (!feed) {
    res.status(404).json({ error: "CCTV feed tidak ditemukan" });
    return null;
  }
  if (!feed.ptzSupported) {
    res.status(422).json({ error: "Kamera ini belum ditandai mendukung PTZ — aktifkan di Edit Feed" });
    return null;
  }
  return feed;
}

/** Starts continuous pan/tilt movement in one direction (held, like a joystick button) via ONVIF. */
cctvRouter.post(
  "/:id/ptz/move",
  requireAuth,
  requireRole("ADMIN", "APARAT", "KEAMANAN_SWASTA"),
  async (req, res) => {
    const parsed = ptzMoveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const feed = await requirePtzFeed(req.params.id, res);
    if (!feed) return;

    try {
      await ptzMove(feed, parsed.data.direction as PtzDirection);
      res.json({ ok: true });
    } catch (err) {
      console.error(`Gagal menggerakkan PTZ feed ${feed.id}:`, err);
      res.status(502).json({ ok: false, error: err instanceof Error ? err.message : "Gagal menggerakkan kamera" });
    }
  }
);

/** Stops any ongoing PTZ movement — must be called on button release, otherwise continuousMove
 * keeps the camera panning/tilting indefinitely. */
cctvRouter.post(
  "/:id/ptz/stop",
  requireAuth,
  requireRole("ADMIN", "APARAT", "KEAMANAN_SWASTA"),
  async (req, res) => {
    const feed = await requirePtzFeed(req.params.id, res);
    if (!feed) return;

    try {
      await ptzStop(feed);
      res.json({ ok: true });
    } catch (err) {
      console.error(`Gagal menghentikan PTZ feed ${feed.id}:`, err);
      res.status(502).json({ ok: false, error: err instanceof Error ? err.message : "Gagal menghentikan kamera" });
    }
  }
);

/** Captures a still photo straight from the camera (ONVIF snapshot), uploads it to evidence
 * storage, and returns its URL so the operator can view/download it from the dashboard. */
cctvRouter.post(
  "/:id/ptz/snapshot",
  requireAuth,
  requireRole("ADMIN", "APARAT", "KEAMANAN_SWASTA"),
  async (req, res) => {
    const feed = await requirePtzFeed(req.params.id, res);
    if (!feed) return;

    try {
      const photo = await ptzSnapshot(feed);
      const url = await uploadEvidenceFile(photo, `ptz-${feed.id}-${Date.now()}.jpg`, "image/jpeg");

      await writeAuditLog({
        userId: req.user!.id,
        action: "PTZ_SNAPSHOT",
        entityType: "CCTVFeed",
        entityId: feed.id,
        detail: { url },
      });

      res.json({ url });
    } catch (err) {
      console.error(`Gagal mengambil snapshot PTZ feed ${feed.id}:`, err);
      res.status(502).json({ error: err instanceof Error ? err.message : "Gagal mengambil foto dari kamera" });
    }
  }
);
