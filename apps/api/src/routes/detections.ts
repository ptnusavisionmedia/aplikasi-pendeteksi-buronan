import rateLimit from "express-rate-limit";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { enqueueNotificationJob } from "../jobs/notification-queue";
import { detectFace } from "../services/detection-engine-client";
import { assessLiveness } from "../services/liveness";
import { prisma } from "../services/prisma";
import { writeAuditLog } from "../services/audit-log";
import { env } from "../env";
import { evidenceRetentionDate, uploadEvidenceFile } from "../services/storage";
import { getOrCreateSettings } from "./settings";
import { parsePagination, paginatedResult } from "../lib/pagination";

export const detectionsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Capture/evidence-save threshold is admin-editable via Pengaturan > "Ambang terkonfirmasi"
// (SystemSetting.detectionMatchThreshold, default 0.7) — this used to be a separate hardcoded
// constant here, out of sync with the Pengaturan UI that looked like it controlled this.
async function getConfidenceThreshold(): Promise<number> {
  const settings = await getOrCreateSettings();
  return settings.detectionMatchThreshold;
}

const OFFICER_ROLES = ["ADMIN", "APARAT", "KEAMANAN_SWASTA"] as const;

const uploadCheckRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

detectionsRouter.post(
  "/upload-check",
  requireAuth,
  uploadCheckRateLimit,
  upload.single("file"),
  async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File wajib diunggah" });

  const imageUrl = await uploadEvidenceFile(req.file.buffer, req.file.originalname, req.file.mimetype);
  const result = await detectFace({ imageUrl });

  const best = result.candidates.sort((a, b) => b.confidence - a.confidence)[0];
  if (!best) return res.json({ matched: false, candidates: [] });

  const confidenceThreshold = await getConfidenceThreshold();
  const event = await prisma.detectionEvent.create({
    data: {
      buronanId: best.buronanId,
      confidenceScore: best.confidence,
      status: best.confidence >= confidenceThreshold ? "MANUAL_CHECK" : "LOW_CONFIDENCE",
    },
  });

  res.json({ matched: true, detectionEventId: event.id, candidates: result.candidates });
});

const devSimulateRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60, // webcam dev loop polls every ~1s; generous but still bounded.
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * FR-24: webcam-as-simulated-CCTV-feed for local development. Runs the same detection engine
 * call as upload-check, but is scoped to a registered DEV_SIMULATION feed and never reaches
 * notification/escalation (FR-25) — enforced below, not just by UI convention.
 */
detectionsRouter.post(
  "/dev-simulate",
  requireAuth,
  devSimulateRateLimit,
  upload.single("frame"),
  async (req, res) => {
    if (env.isProduction) {
      return res.status(403).json({ error: "Mode simulasi webcam tidak tersedia di production" });
    }
    if (!req.file) return res.status(400).json({ error: "Frame webcam wajib diunggah" });

    const cctvFeedId = req.body.cctvFeedId as string | undefined;
    if (!cctvFeedId) return res.status(400).json({ error: "cctvFeedId wajib diisi" });

    const feed = await prisma.cCTVFeed.findUnique({ where: { id: cctvFeedId } });
    if (!feed) return res.status(404).json({ error: "CCTV feed tidak ditemukan" });
    if (feed.sourceType !== "DEV_SIMULATION") {
      return res.status(422).json({ error: "Feed ini bukan feed simulasi (sourceType != DEV_SIMULATION)" });
    }

    const imageUrl = await uploadEvidenceFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    const result = await detectFace({ imageUrl });
    const best = result.candidates.sort((a, b) => b.confidence - a.confidence)[0];

    if (!best) return res.json({ matched: false, candidates: [] });

    const confidenceThreshold = await getConfidenceThreshold();
    const event = await prisma.detectionEvent.create({
      data: {
        cctvFeedId: feed.id,
        buronanId: best.buronanId,
        confidenceScore: best.confidence,
        status: best.confidence >= confidenceThreshold ? "PENDING_CONFIRMATION" : "LOW_CONFIDENCE",
        isLive: true,
      },
    });
    // Deliberately no evidence.create / enqueueNotificationJob here — a dev simulation frame
    // must never produce a real evidence record or page a real officer.

    res.json({ matched: true, detectionEventId: event.id, candidates: result.candidates, sourceType: feed.sourceType });
  }
);

const webhookSchema = z.object({
  cctvFeedId: z.string().uuid(),
  buronanId: z.string().uuid(),
  confidence: z.number().min(0).max(1),
  snapshotUrl: z.string(),
  // Reported by the detection engine's liveness model once it ships (FR-20); optional so the
  // contract stays backward-compatible with an engine that doesn't send it yet.
  isLive: z.boolean().optional(),
});

/** Called by the detection engine (FastAPI) internally — never exposed to Web/Mobile clients. */
detectionsRouter.post("/webhook", async (req, res) => {
  if (req.headers["x-internal-api-key"] !== env.detectionEngineApiKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const parsed = webhookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { cctvFeedId, buronanId, confidence, snapshotUrl, isLive } = parsed.data;

  const cctvFeed = await prisma.cCTVFeed.findUnique({ where: { id: cctvFeedId } });
  if (!cctvFeed) return res.status(404).json({ error: "CCTV feed tidak ditemukan" });

  // Guards against a stale Qdrant embedding (e.g. left behind by a buronan whose deletion's
  // Qdrant cleanup failed) matching a buronanId that no longer exists in Postgres — without this,
  // detectionEvent.create below throws an unhandled FK violation (P2003) that crashes the process.
  const buronanExists = await prisma.buronan.findUnique({ where: { id: buronanId }, select: { id: true } });
  if (!buronanExists) return res.status(404).json({ error: "Buronan tidak ditemukan (kemungkinan embedding usang)" });

  const live = assessLiveness({ isLive });
  const isDevSimulation = cctvFeed.sourceType === "DEV_SIMULATION";

  if (!live) {
    const event = await prisma.detectionEvent.create({
      data: { cctvFeedId, buronanId, confidenceScore: confidence, status: "REJECTED_FALSE_POSITIVE", isLive: false },
    });
    await writeAuditLog({
      action: "SPOOF_ATTEMPT_DETECTED",
      entityType: "DetectionEvent",
      entityId: event.id,
      detail: { cctvFeedId, confidence },
    });
    // No evidence, no notification, no escalation path — FR-20 stops a spoofed frame right here.
    return res.status(201).json({ detectionEventId: event.id, isLive: false });
  }

  // FR-19: a high-confidence match no longer auto-escalates. It waits for an officer's
  // confirm/reject decision (see PATCH /:id/confirm|reject) before FR-14 Escalation can fire.
  const confidenceThreshold = await getConfidenceThreshold();

  // Below ambang kecocokan (SystemSetting.detectionMatchThreshold, default 70%) — tidak disimpan
  // ke riwayat deteksi sama sekali. Sebelumnya tetap dibuat sebagai DetectionEvent berstatus
  // LOW_CONFIDENCE, membanjiri daftar Deteksi dengan hasil di bawah ambang yang tidak actionable
  // (kamera live mengirim webhook tiap beberapa detik). Kotak overlay di Mode Fokus tidak
  // terpengaruh — itu didorong dari live-detection cache di detection-engine, bukan dari tabel
  // ini — jadi operator tetap melihat semua kecocokan real-time, hanya histori/evidence/
  // notifikasi yang dibatasi ke kecocokan yang cukup yakin.
  if (confidence < confidenceThreshold) {
    return res.status(200).json({ skipped: true, reason: "confidence_below_threshold" });
  }

  const event = await prisma.detectionEvent.create({
    data: { cctvFeedId, buronanId, confidenceScore: confidence, status: "PENDING_CONFIRMATION", isLive: true },
  });

  await prisma.evidence.create({
    data: {
      detectionEventId: event.id,
      fileUrl: snapshotUrl,
      retentionUntil: evidenceRetentionDate(),
    },
  });

  // FR-25: a dev/staging simulation feed (webcam) never reaches a real officer's inbox.
  if (!isDevSimulation) {
    await enqueueNotificationJob({ detectionEventId: event.id });
  }

  res.status(201).json({ detectionEventId: event.id });
});

/** FR-19: officer confirms a pending match, unblocking FR-14 Escalation. */
detectionsRouter.patch("/:id/confirm", requireAuth, requireRole(...OFFICER_ROLES), async (req, res) => {
  const event = await prisma.detectionEvent.findUnique({ where: { id: req.params.id } });
  if (!event) return res.status(404).json({ error: "Detection event tidak ditemukan" });
  if (event.status === "CONFIRMED_BY_OFFICER" || event.status === "REJECTED_FALSE_POSITIVE") {
    return res.status(409).json({ error: "Match ini sudah ditinjau" });
  }

  const updated = await prisma.detectionEvent.update({
    where: { id: event.id },
    data: { status: "CONFIRMED_BY_OFFICER", confirmedById: req.user!.id, confirmedAt: new Date() },
  });

  await writeAuditLog({
    userId: req.user!.id,
    action: "CONFIRM_DETECTION",
    entityType: "DetectionEvent",
    entityId: event.id,
  });

  res.json(updated);
});

const rejectDetectionSchema = z.object({
  reason: z.string().min(1, "Alasan penolakan wajib diisi"),
});

/** FR-19/FR-22: officer marks a match as a false positive; feeds the per-camera accuracy metric. */
detectionsRouter.patch("/:id/reject", requireAuth, requireRole(...OFFICER_ROLES), async (req, res) => {
  const parsed = rejectDetectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const event = await prisma.detectionEvent.findUnique({ where: { id: req.params.id } });
  if (!event) return res.status(404).json({ error: "Detection event tidak ditemukan" });
  if (event.status === "CONFIRMED_BY_OFFICER" || event.status === "REJECTED_FALSE_POSITIVE") {
    return res.status(409).json({ error: "Match ini sudah ditinjau" });
  }

  const updated = await prisma.detectionEvent.update({
    where: { id: event.id },
    data: {
      status: "REJECTED_FALSE_POSITIVE",
      confirmedById: req.user!.id,
      confirmedAt: new Date(),
      rejectionReason: parsed.data.reason,
    },
  });

  await writeAuditLog({
    userId: req.user!.id,
    action: "REJECT_DETECTION",
    entityType: "DetectionEvent",
    entityId: event.id,
    detail: { reason: parsed.data.reason },
  });

  res.json(updated);
});

detectionsRouter.get("/", requireAuth, async (req, res) => {
  const { wilayah, from, to, includeDevSimulation, q } = req.query as {
    wilayah?: string;
    from?: string;
    to?: string;
    includeDevSimulation?: string;
    q?: string;
  };
  const pagination = parsePagination(req.query as Record<string, unknown>);

  // FR-25: dev/staging webcam simulation feeds are hidden from the production dashboard
  // unless explicitly asked for. Events with no CCTV feed at all (community reports, manual
  // upload-check) have nothing to exclude and must stay visible — `is: { sourceType: ... }`
  // on this optional relation would otherwise drop every one of them, since it requires a
  // *matching* related row, not merely the absence of a DEV_SIMULATION one.
  const where = {
    ...(wilayah ? { cctvFeed: { wilayah } } : {}),
    ...(includeDevSimulation === "true"
      ? {}
      : { OR: [{ cctvFeedId: null }, { cctvFeed: { sourceType: { not: "DEV_SIMULATION" as const } } }] }),
    ...(from || to
      ? { detectedAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } }
      : {}),
    ...(q
      ? {
          AND: [
            {
              OR: [
                { buronan: { nama: { contains: q, mode: "insensitive" as const } } },
                { cctvFeed: { nama: { contains: q, mode: "insensitive" as const } } },
              ],
            },
          ],
        }
      : {}),
  };

  const [events, total] = await Promise.all([
    prisma.detectionEvent.findMany({
      where,
      include: { buronan: { include: { fotos: true } }, cctvFeed: true, evidence: true },
      orderBy: { detectedAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.detectionEvent.count({ where }),
  ]);

  res.json(paginatedResult(events, total, pagination));
});

// Dashboard aggregates (hero total, 7-day trend, status breakdown) — computed server-side so the
// dashboard doesn't need an unbounded detections fetch to stay accurate once /detections is paginated.
detectionsRouter.get("/stats", requireAuth, async (req, res) => {
  const { wilayah } = req.query as { wilayah?: string };
  const where = {
    ...(wilayah ? { cctvFeed: { wilayah } } : {}),
    OR: [{ cctvFeedId: null }, { cctvFeed: { sourceType: { not: "DEV_SIMULATION" as const } } }],
  };

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [total, statusCounts, recentEvents] = await Promise.all([
    prisma.detectionEvent.count({ where }),
    prisma.detectionEvent.groupBy({ by: ["status"], where, _count: { status: true } }),
    prisma.detectionEvent.findMany({
      where: { ...where, detectedAt: { gte: sevenDaysAgo } },
      select: { detectedAt: true },
    }),
  ]);

  const today = new Date().toDateString();
  const todayCount = recentEvents.filter((e) => e.detectedAt.toDateString() === today).length;

  const trendByDay = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    trendByDay.set(d.toDateString(), 0);
  }
  for (const e of recentEvents) {
    const key = e.detectedAt.toDateString();
    if (trendByDay.has(key)) trendByDay.set(key, (trendByDay.get(key) ?? 0) + 1);
  }
  const trend = Array.from(trendByDay.entries()).map(([date, count]) => ({ date, count }));

  const statusBreakdown: Record<string, number> = {};
  for (const row of statusCounts) statusBreakdown[row.status] = row._count.status;

  res.json({ total, todayCount, trend, statusBreakdown });
});

detectionsRouter.get("/:id", requireAuth, async (req, res) => {
  const event = await prisma.detectionEvent.findUnique({
    where: { id: req.params.id },
    include: { buronan: { include: { fotos: true } }, cctvFeed: true, evidence: true },
  });
  if (!event) return res.status(404).json({ error: "Detection event tidak ditemukan" });
  res.json(event);
});

detectionsRouter.get("/:id/evidence", requireAuth, async (req, res) => {
  const evidence = await prisma.evidence.findUnique({ where: { detectionEventId: req.params.id } });
  if (!evidence) return res.status(404).json({ error: "Evidence tidak ditemukan" });
  res.json(evidence);
});

// Bulk wipe, requested explicitly when moving Deteksi to the card UI (old test/stale rows cluttering
// the new view). Children have no ON DELETE CASCADE in the schema, so clear them first, in a
// transaction, so a failure midway never leaves the tables half-cleared.
detectionsRouter.delete("/clear", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const countBefore = await prisma.detectionEvent.count();

  await prisma.$transaction([
    prisma.appeal.deleteMany({}),
    prisma.notification.deleteMany({}),
    prisma.escalation.deleteMany({}),
    prisma.evidence.deleteMany({}),
    prisma.detectionEvent.deleteMany({}),
  ]);

  await writeAuditLog({
    userId: req.user!.id,
    action: "CLEAR_ALL_DETECTIONS",
    entityType: "DetectionEvent",
    entityId: "bulk",
    detail: { countDeleted: countBefore },
  });

  res.json({ countDeleted: countBefore });
});
