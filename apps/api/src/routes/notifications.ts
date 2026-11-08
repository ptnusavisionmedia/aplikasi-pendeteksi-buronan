import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../services/prisma";
import { parsePagination, paginatedResult } from "../lib/pagination";

export const notificationsRouter = Router();

notificationsRouter.get("/", requireAuth, async (req, res) => {
  const { q } = req.query as { q?: string };
  const pagination = parsePagination(req.query as Record<string, unknown>);

  const where = {
    userId: req.user!.id,
    ...(q
      ? {
          OR: [
            { detectionEvent: { is: { buronan: { nama: { contains: q, mode: "insensitive" as const } } } } },
            { buronan: { is: { nama: { contains: q, mode: "insensitive" as const } } } },
            { title: { contains: q, mode: "insensitive" as const } },
            { body: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      include: {
        detectionEvent: { include: { buronan: true, cctvFeed: true } },
        buronan: { include: { fotos: { where: { isPrimary: true }, take: 1 } } },
        beritaAcara: true,
      },
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.notification.count({ where }),
  ]);

  res.json(paginatedResult(notifications, total, pagination));
});

// Dipakai badge titik merah di ikon lonceng Home mobile/web — ringan (cuma count), jadi aman
// dipanggil lebih sering daripada GET / yang penuh (include relasi + pagination).
notificationsRouter.get("/unread-count", requireAuth, async (req, res) => {
  const count = await prisma.notification.count({ where: { userId: req.user!.id, isRead: false } });
  res.json({ count });
});

notificationsRouter.patch("/:id/read", requireAuth, async (req, res) => {
  const existing = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.user!.id) {
    return res.status(404).json({ error: "Notifikasi tidak ditemukan" });
  }
  const notification = await prisma.notification.update({
    where: { id: req.params.id },
    data: { isRead: true },
  });
  res.json(notification);
});

notificationsRouter.patch("/read-all", requireAuth, async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, isRead: false },
    data: { isRead: true },
  });
  res.status(204).end();
});
