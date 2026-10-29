import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { writeAuditLog } from "../services/audit-log";
import { startCctvFeed, stopCctvFeed } from "../services/detection-engine-client";
import { prisma } from "../services/prisma";

export const cctvRouter = Router();

const createFeedSchema = z.object({
  nama: z.string().min(1),
  lokasi: z.string().min(1),
  urlStream: z.string().url(),
  wilayah: z.string().min(1),
});

cctvRouter.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "APARAT", "KEAMANAN_SWASTA"),
  async (req, res) => {
    const parsed = createFeedSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const feed = await prisma.cCTVFeed.create({
      data: { ...parsed.data, ownerId: req.user!.id, instansiId: req.user!.instansiId },
    });

    await startCctvFeed(feed.id, feed.urlStream).catch((err) => {
      console.error(`Gagal memulai feed ${feed.id} di detection engine:`, err);
    });

    await writeAuditLog({
      userId: req.user!.id,
      action: "CREATE_CCTV_FEED",
      entityType: "CCTVFeed",
      entityId: feed.id,
    });

    res.status(201).json(feed);
  }
);

cctvRouter.get("/", requireAuth, async (req, res) => {
  const scope = req.user!.role === "ADMIN" ? undefined : req.user!.wilayahScope ?? undefined;
  const feeds = await prisma.cCTVFeed.findMany({
    where: scope ? { wilayah: scope } : undefined,
    orderBy: { createdAt: "desc" },
  });
  res.json(feeds);
});

const updateFeedSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "OFFLINE"]).optional(),
  nama: z.string().optional(),
  urlStream: z.string().url().optional(),
});

cctvRouter.patch(
  "/:id",
  requireAuth,
  requireRole("ADMIN", "APARAT", "KEAMANAN_SWASTA"),
  async (req, res) => {
    const parsed = updateFeedSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const feed = await prisma.cCTVFeed.update({ where: { id: req.params.id }, data: parsed.data });

    if (parsed.data.status === "INACTIVE" || parsed.data.status === "OFFLINE") {
      await stopCctvFeed(feed.id).catch((err) => console.error(`Gagal stop feed ${feed.id}:`, err));
    }

    await writeAuditLog({
      userId: req.user!.id,
      action: "UPDATE_CCTV_FEED",
      entityType: "CCTVFeed",
      entityId: feed.id,
      detail: parsed.data,
    });

    res.json(feed);
  }
);
