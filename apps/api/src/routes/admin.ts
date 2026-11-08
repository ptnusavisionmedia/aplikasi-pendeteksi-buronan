import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { writeAuditLog } from "../services/audit-log";
import { prisma } from "../services/prisma";
import { parsePagination, paginatedResult } from "../lib/pagination";

export const adminRouter = Router();

const SAFE_USER_FIELDS = {
  id: true,
  email: true,
  nama: true,
  role: true,
  instansiId: true,
  wilayahScope: true,
  isVerified: true,
  createdAt: true,
} as const;

const ROLE_VALUES = ["ADMIN", "APARAT", "KEAMANAN_SWASTA", "INSTANSI_HUKUM", "MASYARAKAT"] as const;
const roleQuerySchema = z.enum(ROLE_VALUES).optional();

adminRouter.get("/users", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const pagination = parsePagination(req.query);
  const q = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : undefined;
  const roleParsed = roleQuerySchema.safeParse(req.query.role);
  if (!roleParsed.success) return res.status(400).json({ error: "Role tidak valid" });
  const role = roleParsed.data;

  const where = {
    ...(role ? { role } : {}),
    ...(q
      ? {
          OR: [
            { nama: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: SAFE_USER_FIELDS,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.user.count({ where }),
  ]);

  res.json(paginatedResult(items, total, pagination));
});

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
