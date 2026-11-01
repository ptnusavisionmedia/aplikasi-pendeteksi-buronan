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
          detectionEvent: {
            is: { buronan: { nama: { contains: q, mode: "insensitive" as const } } },
          },
        }
      : {}),
  };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      include: { detectionEvent: { include: { buronan: true, cctvFeed: true } } },
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.notification.count({ where }),
  ]);

  res.json(paginatedResult(notifications, total, pagination));
});
