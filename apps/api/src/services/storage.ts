import { randomUUID } from "crypto";
import { Client } from "minio";
import { env } from "../env";

export const minioClient = new Client({
  endPoint: env.minio.endpoint,
  port: env.minio.port,
  useSSL: env.minio.useSSL,
  accessKey: env.minio.accessKey,
  secretKey: env.minio.secretKey,
});

export async function ensureEvidenceBucket() {
  const exists = await minioClient.bucketExists(env.minio.bucket).catch(() => false);
  if (!exists) await minioClient.makeBucket(env.minio.bucket);
}

export async function uploadEvidenceFile(buffer: Buffer, originalName: string, contentType: string) {
  const ext = originalName.includes(".") ? originalName.split(".").pop() : "bin";
  const objectName = `${randomUUID()}.${ext}`;

  await minioClient.putObject(env.minio.bucket, objectName, buffer, buffer.length, {
    "Content-Type": contentType,
  });

  // Served through the API's own /evidence/:objectName proxy rather than a direct MinIO URL:
  // MinIO/S3Mock only listens on this host's internal network, and its bucket has no auth of its
  // own (see ensureEvidenceBucket) — proxying through the API means the object storage never has
  // to be exposed publicly itself, only the already-public API is.
  return `${env.publicUrl}/evidence/${objectName}`;
}

export function evidenceRetentionDate(fromDate = new Date()) {
  const retentionDays = 90;
  return new Date(fromDate.getTime() + retentionDays * 24 * 60 * 60 * 1000);
}

export async function getEvidenceUrl(objectName: string, expirySeconds = 60 * 60) {
  return minioClient.presignedGetObject(env.minio.bucket, objectName, expirySeconds);
}
