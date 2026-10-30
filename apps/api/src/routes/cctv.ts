import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { writeAuditLog } from "../services/audit-log";
import { computeCameraAccuracy } from "../services/camera-accuracy";
import { checkCctvFeed, getLiveDetection, startCctvFeed, stopCctvFeed } from "../services/detection-engine-client";
import { ensureLivePath, liveHlsUrl } from "../services/mediamtx-client";
import { env } from "../env";
import { prisma } from "../services/prisma";

export const cctvRouter = Router();

const createFeedSchema = z.object({
  nama: z.string().min(1),
  lokasi: z.string().min(1),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  urlStream: z.string().url(),
  wilayah: z.string().min(1),
  // FR-24: webcam-as-simulated-feed for dev/staging only, never production.
  sourceType: z.enum(["PRODUCTION", "DEV_SIMULATION"]).optional(),
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

    await startCctvFeed(feed.id, feed.urlStream).catch((err) => {
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
  urlStream: z.string().url().optional(),
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
      await startCctvFeed(feed.id, feed.urlStream).catch((err) => console.error(`Gagal start feed ${feed.id}:`, err));
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

/** One-shot connectivity test for the "Cek Koneksi" button — does not start the detection loop. */
cctvRouter.post("/:id/check", requireAuth, async (req, res) => {
  const feed = await prisma.cCTVFeed.findUnique({ where: { id: req.params.id } });
  if (!feed) return res.status(404).json({ error: "CCTV feed tidak ditemukan" });

  try {
    const result = await checkCctvFeed(feed.urlStream);
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
    res.status(502).json({ error: "Gagal menyiapkan live stream" });
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
