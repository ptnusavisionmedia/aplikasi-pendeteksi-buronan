import rateLimit from "express-rate-limit";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { enqueueNotificationJob } from "../jobs/notification-queue";
import { detectFace } from "../services/detection-engine-client";
import { prisma } from "../services/prisma";
import { env } from "../env";
import { evidenceRetentionDate, uploadEvidenceFile } from "../services/storage";

export const detectionsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const CONFIDENCE_THRESHOLD = 0.85;

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

const webhookSchema = z.object({
  cctvFeedId: z.string().uuid(),
  buronanId: z.string().uuid(),
  confidence: z.number().min(0).max(1),
  snapshotUrl: z.string(),
});

/** Called by the detection engine (FastAPI) internally — never exposed to Web/Mobile clients. */
detectionsRouter.post("/webhook", async (req, res) => {
  if (req.headers["x-internal-api-key"] !== env.detectionEngineApiKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const parsed = webhookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { cctvFeedId, buronanId, confidence, snapshotUrl } = parsed.data;

  const event = await prisma.detectionEvent.create({
    data: {
      cctvFeedId,
      buronanId,
      confidenceScore: confidence,
      status: confidence >= CONFIDENCE_THRESHOLD ? "CONFIRMED" : "LOW_CONFIDENCE",
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
    await enqueueNotificationJob({ detectionEventId: event.id });
  }

  res.status(201).json({ detectionEventId: event.id });
});

detectionsRouter.get("/", requireAuth, async (req, res) => {
  const { wilayah, from, to } = req.query as { wilayah?: string; from?: string; to?: string };

  const events = await prisma.detectionEvent.findMany({
    where: {
      ...(wilayah ? { cctvFeed: { wilayah } } : {}),
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
