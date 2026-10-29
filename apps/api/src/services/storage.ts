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

  // Dev bucket is publicly readable (s3mock default), so a direct URL works without signing.
  // A private production bucket should use getEvidenceUrl() (presigned) instead.
  const scheme = env.minio.useSSL ? "https" : "http";
  return `${scheme}://${env.minio.endpoint}:${env.minio.port}/${env.minio.bucket}/${objectName}`;
}

export function evidenceRetentionDate(fromDate = new Date()) {
  const retentionDays = 90;
  return new Date(fromDate.getTime() + retentionDays * 24 * 60 * 60 * 1000);
}

export async function getEvidenceUrl(objectName: string, expirySeconds = 60 * 60) {
  return minioClient.presignedGetObject(env.minio.bucket, objectName, expirySeconds);
}
