import type { NotificationType } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Notifikasi broadcast (buronan baru, buronan tertangkap, berita acara baru) — dibuat langsung
 * (bukan lewat BullMQ seperti jobs/notification-worker.ts) karena tidak ada pengiriman eksternal
 * nyata yang perlu retry/backoff, cuma insert DB; channel tetap PUSH dan status langsung SENT
 * untuk konsisten dengan perilaku notification-worker.ts yang juga belum terhubung ke provider
 * push sungguhan (lihat TODO di sana).
 */
export async function broadcastNotification(params: {
  type: NotificationType;
  title: string;
  body: string;
  buronanId?: string;
  beritaAcaraId?: string;
}) {
  const recipients = await prisma.user.findMany({ select: { id: true } });
  if (recipients.length === 0) return;

  await prisma.notification.createMany({
    data: recipients.map((recipient) => ({
      userId: recipient.id,
      type: params.type,
      title: params.title,
      body: params.body,
      buronanId: params.buronanId,
      beritaAcaraId: params.beritaAcaraId,
      channel: "PUSH" as const,
      status: "SENT" as const,
      sentAt: new Date(),
    })),
  });

  console.log(`[notif] broadcast ${params.type} to ${recipients.length} user(s): ${params.title}`);
}
