import rateLimit from "express-rate-limit";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { writeAuditLog } from "../services/audit-log";
import { prisma } from "../services/prisma";
import { uploadEvidenceFile } from "../services/storage";

/** FR-23: kanal sanggahan bagi pihak yang merasa salah terdeteksi/dilaporkan. */
export const appealsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const appealRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const createAppealSchema = z.object({
  detectionEventId: z.string().uuid(),
  namaPengaju: z.string().min(1),
  kontakPengaju: z.string().min(1),
  deskripsi: z.string().min(1),
});

// Deliberately open to the public (no requireAuth): the person appealing is the one allegedly
// misidentified, who may not have — and shouldn't need — an account in this system.
appealsRouter.post("/", appealRateLimit, upload.single("bukti"), async (req, res) => {
  const parsed = createAppealSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const event = await prisma.detectionEvent.findUnique({ where: { id: parsed.data.detectionEventId } });
  if (!event) return res.status(404).json({ error: "Detection event tidak ditemukan" });

  const buktiUrl = req.file
    ? await uploadEvidenceFile(req.file.buffer, req.file.originalname, req.file.mimetype)
    : undefined;

  const appeal = await prisma.appeal.create({
    data: { ...parsed.data, buktiUrl },
  });

  res.status(201).json({ id: appeal.id, status: appeal.status, createdAt: appeal.createdAt });
});

appealsRouter.get("/", requireAuth, requireRole("ADMIN", "APARAT", "KEAMANAN_SWASTA"), async (_req, res) => {
  const appeals = await prisma.appeal.findMany({
    where: { status: "MENUNGGU" },
    include: { detectionEvent: { include: { buronan: true, cctvFeed: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(appeals);
});

const reviewAppealSchema = z.object({
  status: z.enum(["DITERIMA", "DITOLAK"]),
  catatanReview: z.string().optional(),
});

appealsRouter.patch(
  "/:id/review",
  requireAuth,
  requireRole("ADMIN", "APARAT"),
  async (req, res) => {
    const parsed = reviewAppealSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const appeal = await prisma.appeal.findUnique({ where: { id: req.params.id } });
    if (!appeal) return res.status(404).json({ error: "Sanggahan tidak ditemukan" });

    const updated = await prisma.appeal.update({
      where: { id: appeal.id },
      data: {
        status: parsed.data.status,
        catatanReview: parsed.data.catatanReview,
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
      },
    });

    // FR-23: an accepted appeal invalidates the underlying match as grounds for action — the
    // evidence record stays (audit trail), but it can no longer be confirmed or escalated.
    if (parsed.data.status === "DITERIMA") {
      await prisma.detectionEvent.update({
        where: { id: appeal.detectionEventId },
        data: {
          status: "REJECTED_FALSE_POSITIVE",
          rejectionReason: "Sanggahan diterima: identitas salah",
        },
      });
    }

    await writeAuditLog({
      userId: req.user!.id,
      action: "REVIEW_APPEAL",
      entityType: "Appeal",
      entityId: appeal.id,
      detail: parsed.data,
    });

    res.json(updated);
  }
);
