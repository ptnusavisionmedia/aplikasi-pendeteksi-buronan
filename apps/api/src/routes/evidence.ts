import { Router } from "express";
import { env } from "../env";
import { minioClient } from "../services/storage";

export const evidenceRouter = Router();

// Streams an object straight from MinIO/S3Mock through the API, so object storage never needs
// to be exposed publicly itself — only this already-public API is. See storage.ts for why.
evidenceRouter.get("/:objectName", async (req, res) => {
  const { objectName } = req.params;
  try {
    const stat = await minioClient.statObject(env.minio.bucket, objectName);
    res.setHeader("Content-Type", stat.metaData["content-type"] ?? "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    const stream = await minioClient.getObject(env.minio.bucket, objectName);
    stream.on("error", () => res.destroy());
    stream.pipe(res);
  } catch {
    res.status(404).json({ error: "Not found" });
  }
});
