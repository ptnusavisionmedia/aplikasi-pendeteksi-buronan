import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../env";

export interface NotificationJobData {
  detectionEventId: string;
}

const connection = new Redis(env.redisUrl, { maxRetriesPerRequest: null });

export const notificationQueue = new Queue<NotificationJobData>("notifications", { connection });

export function enqueueNotificationJob(data: NotificationJobData) {
  return notificationQueue.add("send-detection-notification", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  });
}
