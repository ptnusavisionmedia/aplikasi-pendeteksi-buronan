import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../services/prisma";

export const notificationsRouter = Router();

notificationsRouter.get("/", requireAuth, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    include: { detectionEvent: { include: { buronan: true, cctvFeed: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(notifications);
});
