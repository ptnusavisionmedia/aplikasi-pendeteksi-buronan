import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { prisma } from "../services/prisma";
import { env } from "../env";

export const settingsRouter = Router();

const DEFAULT_SETTINGS = {
  id: "default",
  cctvAutoCheckIntervalSeconds: 30,
  liveDetectionPollIntervalMs: 1200,
  detectionReportThreshold: 0.5,
  detectionMatchThreshold: 0.9,
};

async function getOrCreateSettings() {
  return prisma.systemSetting.upsert({
    where: { id: "default" },
    update: {},
    create: DEFAULT_SETTINGS,
  });
}

/** Any authenticated role can read settings — the web app needs them (e.g. CCTV auto-check
 * interval) regardless of who's logged in; only ADMIN can change them (see PATCH below). */
settingsRouter.get("/", requireAuth, async (_req, res) => {
  res.json(await getOrCreateSettings());
});

const updateSettingsSchema = z.object({
  cctvAutoCheckIntervalSeconds: z.number().int().min(10).max(300).optional(),
  liveDetectionPollIntervalMs: z.number().int().min(300).max(5000).optional(),
  detectionReportThreshold: z.number().min(0).max(1).optional(),
  detectionMatchThreshold: z.number().min(0).max(1).optional(),
});

settingsRouter.patch("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (
    parsed.data.detectionReportThreshold !== undefined &&
    parsed.data.detectionMatchThreshold !== undefined &&
    parsed.data.detectionReportThreshold > parsed.data.detectionMatchThreshold
  ) {
    return res.status(400).json({
      error: "Ambang batas laporan tidak boleh lebih tinggi dari ambang batas kecocokan terkonfirmasi",
    });
  }

  await getOrCreateSettings(); // ensure the row exists before patching
  const updated = await prisma.systemSetting.update({ where: { id: "default" }, data: parsed.data });
  res.json(updated);
});

/** Polled by detection-engine (never by Web/Mobile) to pick up threshold changes without its
 * own restart — same shared-secret pattern as the detections/webhook route. */
settingsRouter.get("/internal", async (req, res) => {
  if (req.headers["x-internal-api-key"] !== env.detectionEngineApiKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json(await getOrCreateSettings());
});
