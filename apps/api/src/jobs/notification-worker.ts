import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../env";
import { prisma } from "../services/prisma";
import type { NotificationJobData } from "./notification-queue";

const connection = new Redis(env.redisUrl, { maxRetriesPerRequest: null });

export const notificationWorker = new Worker<NotificationJobData>(
  "notifications",
  async (job) => {
    const event = await prisma.detectionEvent.findUnique({
      where: { id: job.data.detectionEventId },
      include: { cctvFeed: true, buronan: true },
    });
    if (!event) return;

    const wilayah = event.cctvFeed?.wilayah;
    const recipients = await prisma.user.findMany({
      where: wilayah ? { wilayahScope: wilayah } : undefined,
    });

    for (const recipient of recipients) {
      const notification = await prisma.notification.create({
        data: {
          userId: recipient.id,
          detectionEventId: event.id,
          channel: "PUSH",
          status: "PENDING",
        },
      });

      // TODO: integrate a real push provider (FCM). Logged for now so the pipeline is observable in dev.
      console.log(
        `[push] -> ${recipient.email}: match ${event.buronan?.nama ?? "DPO"} @ ${event.cctvFeed?.lokasi ?? "lokasi tidak diketahui"} (${Math.round(event.confidenceScore * 100)}%)`
      );

      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "SENT", sentAt: new Date() },
      });
    }
  },
  { connection }
);

notificationWorker.on("failed", (job, err) => {
  console.error(`Notification job ${job?.id} failed:`, err);
});
