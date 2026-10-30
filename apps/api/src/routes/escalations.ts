import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { writeAuditLog } from "../services/audit-log";
import { prisma } from "../services/prisma";

export const escalationsRouter = Router();

const createEscalationSchema = z.object({
  detectionEventId: z.string().uuid(),
  instansiTujuanId: z.string().uuid(),
  catatan: z.string().optional(),
});

escalationsRouter.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "APARAT", "KEAMANAN_SWASTA"),
  async (req, res) => {
    const parsed = createEscalationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const event = await prisma.detectionEvent.findUnique({
      where: { id: parsed.data.detectionEventId },
      include: { evidence: true },
    });
    if (!event) return res.status(404).json({ error: "Detection event tidak ditemukan" });
    if (!event.evidence) {
      return res.status(422).json({ error: "Eskalasi wajib memiliki evidence terlampir" });
    }
    // FR-19: no eskalasi boleh terkirim tanpa konfirmasi manusia, berapa pun confidence-nya.
    if (event.status !== "CONFIRMED_BY_OFFICER") {
      return res.status(422).json({
        error: "Match wajib dikonfirmasi petugas (PATCH /detections/:id/confirm) sebelum eskalasi",
      });
    }

    const escalation = await prisma.escalation.create({
      data: { ...parsed.data, dibuatOlehId: req.user!.id },
    });

    await writeAuditLog({
      userId: req.user!.id,
      action: "CREATE_ESCALATION",
      entityType: "Escalation",
      entityId: escalation.id,
    });

    res.status(201).json(escalation);
  }
);

escalationsRouter.get("/", requireAuth, async (req, res) => {
  const escalations = await prisma.escalation.findMany({
    where:
      req.user!.role === "ADMIN"
        ? undefined
        : { OR: [{ dibuatOlehId: req.user!.id }, { instansiTujuanId: req.user!.instansiId ?? "" }] },
    include: { detectionEvent: { include: { buronan: true } }, instansiTujuan: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(escalations);
});

const updateEscalationSchema = z.object({
  status: z.enum(["PENDING", "DITINDAKLANJUTI", "SELESAI"]),
});

escalationsRouter.patch("/:id", requireAuth, requireRole("ADMIN", "APARAT"), async (req, res) => {
  const parsed = updateEscalationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const escalation = await prisma.escalation.update({
    where: { id: req.params.id },
    data: { status: parsed.data.status },
  });

  await writeAuditLog({
    userId: req.user!.id,
    action: "UPDATE_ESCALATION_STATUS",
    entityType: "Escalation",
    entityId: escalation.id,
    detail: parsed.data,
  });

  res.json(escalation);
});
