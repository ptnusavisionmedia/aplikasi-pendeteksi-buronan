import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { writeAuditLog } from "../services/audit-log";
import { prisma } from "../services/prisma";
import { parsePagination, paginatedResult } from "../lib/pagination";

export const escalationsRouter = Router();

/** Same role-based row visibility as GET / below, factored out so /stats and the list endpoint
 * can never drift apart on who gets to see which escalations. */
function visibilityWhere(user: Express.Request["user"]) {
  return user!.role === "ADMIN"
    ? undefined
    : { OR: [{ dibuatOlehId: user!.id }, { instansiTujuanId: user!.instansiId ?? "" }] };
}

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
  const { q } = req.query as { q?: string };
  const pagination = parsePagination(req.query as Record<string, unknown>);
  const visibility = visibilityWhere(req.user);

  const where = {
    ...(visibility ?? {}),
    ...(q
      ? {
          AND: [
            {
              OR: [
                { detectionEvent: { is: { buronan: { nama: { contains: q, mode: "insensitive" as const } } } } },
                { instansiTujuan: { is: { nama: { contains: q, mode: "insensitive" as const } } } },
              ],
            },
          ],
        }
      : {}),
  };

  const [escalations, total] = await Promise.all([
    prisma.escalation.findMany({
      where,
      include: { detectionEvent: { include: { buronan: true } }, instansiTujuan: true },
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.escalation.count({ where }),
  ]);
  res.json(paginatedResult(escalations, total, pagination));
});

escalationsRouter.get("/stats", requireAuth, async (req, res) => {
  const where = visibilityWhere(req.user);

  const counts = await prisma.escalation.groupBy({
    by: ["status"],
    where,
    _count: { status: true },
  });

  const byStatus = { PENDING: 0, DITINDAKLANJUTI: 0, SELESAI: 0 };
  for (const row of counts) byStatus[row.status] = row._count.status;

  res.json({ ...byStatus, total: byStatus.PENDING + byStatus.DITINDAKLANJUTI + byStatus.SELESAI });
});

escalationsRouter.get("/:id", requireAuth, async (req, res) => {
  const escalation = await prisma.escalation.findUnique({
    where: { id: req.params.id },
    include: {
      detectionEvent: { include: { buronan: true, evidence: true, cctvFeed: true } },
      instansiTujuan: true,
      dibuatOleh: { select: { id: true, nama: true, email: true, role: true } },
    },
  });
  if (!escalation) return res.status(404).json({ error: "Eskalasi tidak ditemukan" });

  const canView =
    req.user!.role === "ADMIN" ||
    escalation.dibuatOlehId === req.user!.id ||
    escalation.instansiTujuanId === req.user!.instansiId;
  if (!canView) return res.status(403).json({ error: "Tidak punya akses ke eskalasi ini" });

  res.json(escalation);
});

const updateEscalationSchema = z.object({
  status: z.enum(["PENDING", "DITINDAKLANJUTI", "SELESAI"]),
});

escalationsRouter.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const escalation = await prisma.escalation.findUnique({ where: { id: req.params.id } });
  if (!escalation) return res.status(404).json({ error: "Eskalasi tidak ditemukan" });

  await prisma.escalation.delete({ where: { id: escalation.id } });

  // The escalation row is gone, but the audit trail of it having existed is not — writeAuditLog
  // below is itself an append-only record, independent of the entity it describes.
  await writeAuditLog({
    userId: req.user!.id,
    action: "DELETE_ESCALATION",
    entityType: "Escalation",
    entityId: escalation.id,
    detail: { detectionEventId: escalation.detectionEventId, instansiTujuanId: escalation.instansiTujuanId },
  });

  res.status(204).end();
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
