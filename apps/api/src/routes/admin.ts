import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { writeAuditLog } from "../services/audit-log";
import { prisma } from "../services/prisma";

export const adminRouter = Router();

const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "APARAT", "KEAMANAN_SWASTA", "INSTANSI_HUKUM", "MASYARAKAT"]),
  wilayahScope: z.string().optional(),
  isVerified: z.boolean().optional(),
});

adminRouter.patch("/users/:id/role", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: parsed.data,
  });

  await writeAuditLog({
    userId: req.user!.id,
    action: "UPDATE_USER_ROLE",
    entityType: "User",
    entityId: user.id,
    detail: parsed.data,
  });

  res.json({ id: user.id, role: user.role, wilayahScope: user.wilayahScope, isVerified: user.isVerified });
});
