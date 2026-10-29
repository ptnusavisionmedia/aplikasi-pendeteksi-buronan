import rateLimit from "express-rate-limit";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { writeAuditLog } from "../services/audit-log";
import { detectFace } from "../services/detection-engine-client";
import { prisma } from "../services/prisma";
import { uploadEvidenceFile } from "../services/storage";

export const reportsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const reportRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const createReportSchema = z.object({
  lokasi: z.string().min(1),
  deskripsi: z.string().optional(),
  anonim: z.coerce.boolean().optional(),
});

reportsRouter.post("/", reportRateLimit, optionalAuth, upload.single("foto"), async (req, res) => {
  const parsed = createReportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!req.file) return res.status(400).json({ error: "Foto wajib diunggah" });

  const fotoUrl = await uploadEvidenceFile(req.file.buffer, req.file.originalname, req.file.mimetype);

  const detectResult = await detectFace({ imageUrl: fotoUrl }).catch(() => ({ candidates: [] }));
  const best = detectResult.candidates.sort((a, b) => b.confidence - a.confidence)[0];

  // req.user is only set when a logged-in user submits via requireAuth upstream; reports.anonim covers the rest.
  const pelaporId = !parsed.data.anonim ? req.user?.id : undefined;

  const report = await prisma.report.create({
    data: {
      pelaporId,
      fotoUrl,
      lokasi: parsed.data.lokasi,
      deskripsi: parsed.data.deskripsi,
      ...(best
        ? {
            detectionEvents: {
              create: {
                buronanId: best.buronanId,
                confidenceScore: best.confidence,
                status: "MANUAL_CHECK",
              },
            },
          }
        : {}),
    },
  });

  res.status(201).json({ ticketId: report.ticketId, status: report.status });
});

reportsRouter.get("/:ticketId", async (req, res) => {
  const report = await prisma.report.findUnique({
    where: { ticketId: req.params.ticketId },
    select: { ticketId: true, status: true, createdAt: true, verifiedAt: true },
  });
  if (!report) return res.status(404).json({ error: "Laporan tidak ditemukan" });
  res.json(report);
});

reportsRouter.get("/", requireAuth, requireRole("ADMIN", "APARAT", "KEAMANAN_SWASTA"), async (req, res) => {
  const reports = await prisma.report.findMany({
    where: { status: "MENUNGGU_VERIFIKASI" },
    include: { detectionEvents: { include: { buronan: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(reports);
});

const verifyReportSchema = z.object({
  status: z.enum(["VALID", "TIDAK_VALID", "INVESTIGASI_LANJUTAN"]),
});

reportsRouter.patch(
  "/:id/verify",
  requireAuth,
  requireRole("ADMIN", "APARAT", "KEAMANAN_SWASTA"),
  async (req, res) => {
    const parsed = verifyReportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status, verifiedById: req.user!.id, verifiedAt: new Date() },
    });

    await writeAuditLog({
      userId: req.user!.id,
      action: "VERIFY_REPORT",
      entityType: "Report",
      entityId: report.id,
      detail: parsed.data,
    });

    res.json(report);
  }
);
