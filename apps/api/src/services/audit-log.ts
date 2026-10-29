import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export async function writeAuditLog(params: {
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  detail?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      detail: params.detail as Prisma.InputJsonValue | undefined,
    },
  });
}
