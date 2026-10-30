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

export const detectionsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const CONFIDENCE_THRESHOLD = 0.9;
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

  const event = await prisma.detectionEvent.create({
    data: {
      buronanId: best.buronanId,
      confidenceScore: best.confidence,
      status: best.confidence >= CONFIDENCE_THRESHOLD ? "MANUAL_CHECK" : "LOW_CONFIDENCE",
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

    const event = await prisma.detectionEvent.create({
      data: {
        cctvFeedId: feed.id,
        buronanId: best.buronanId,
        confidenceScore: best.confidence,
        status: best.confidence >= CONFIDENCE_THRESHOLD ? "PENDING_CONFIRMATION" : "LOW_CONFIDENCE",
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
  const event = await prisma.detectionEvent.create({
    data: {
      cctvFeedId,
      buronanId,
      confidenceScore: confidence,
      status: confidence >= CONFIDENCE_THRESHOLD ? "PENDING_CONFIRMATION" : "LOW_CONFIDENCE",
      isLive: true,
    },
  });

  if (confidence >= CONFIDENCE_THRESHOLD) {
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
  const { wilayah, from, to, includeDevSimulation } = req.query as {
    wilayah?: string;
    from?: string;
    to?: string;
    includeDevSimulation?: string;
  };

  const events = await prisma.detectionEvent.findMany({
    where: {
      ...(wilayah ? { cctvFeed: { wilayah } } : {}),
      // FR-25: dev/staging webcam simulation feeds are hidden from the production dashboard
      // unless explicitly asked for. Events with no CCTV feed at all (community reports, manual
      // upload-check) have nothing to exclude and must stay visible — `is: { sourceType: ... }`
      // on this optional relation would otherwise drop every one of them, since it requires a
      // *matching* related row, not merely the absence of a DEV_SIMULATION one.
      ...(includeDevSimulation === "true"
        ? {}
        : { OR: [{ cctvFeedId: null }, { cctvFeed: { sourceType: { not: "DEV_SIMULATION" } } }] }),
      ...(from || to
        ? { detectedAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } }
        : {}),
    },
    include: { buronan: true, cctvFeed: true, evidence: true },
    orderBy: { detectedAt: "desc" },
    take: 100,
  });

  res.json(events);
});

detectionsRouter.get("/:id", requireAuth, async (req, res) => {
  const event = await prisma.detectionEvent.findUnique({
    where: { id: req.params.id },
    include: { buronan: true, cctvFeed: true, evidence: true },
  });
  if (!event) return res.status(404).json({ error: "Detection event tidak ditemukan" });
  res.json(event);
});

detectionsRouter.get("/:id/evidence", requireAuth, async (req, res) => {
  const evidence = await prisma.evidence.findUnique({ where: { detectionEventId: req.params.id } });
  if (!evidence) return res.status(404).json({ error: "Evidence tidak ditemukan" });
  res.json(evidence);
});
