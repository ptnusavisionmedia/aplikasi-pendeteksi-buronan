import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "24h",
  detectionEngineUrl: process.env.DETECTION_ENGINE_URL ?? "http://localhost:8000",
  detectionEngineApiKey: process.env.DETECTION_ENGINE_API_KEY ?? "",
  mediamtx: {
    // Server-side: apps/api calls MediaMTX's config API to register/update RTSP->HLS paths.
    apiUrl: process.env.MEDIAMTX_API_URL ?? "http://localhost:9997",
    // Browser-facing: the URL the web dashboard's <video> player fetches HLS segments from.
    hlsBaseUrl: process.env.MEDIAMTX_HLS_BASE_URL ?? "http://localhost:8888",
    // detection-engine-facing: MediaMTX's own RTSP server. The detection loop reads a feed's
    // stream from here instead of connecting to the camera directly, so it shares MediaMTX's
    // single upstream camera connection with the Mode Fokus viewer rather than opening a second,
    // competing RTSP session on the camera (which some cameras, e.g. Tapo C200, can't sustain
    // alongside the first — the second session ends up fed stale/corrupted frames).
    rtspUrl: process.env.MEDIAMTX_RTSP_URL ?? "rtsp://localhost:8554",
  },
  minio: {
    endpoint: process.env.MINIO_ENDPOINT ?? "localhost",
    port: Number(process.env.MINIO_PORT ?? 9000),
    accessKey: process.env.MINIO_ACCESS_KEY ?? "buronan",
    secretKey: process.env.MINIO_SECRET_KEY ?? "buronan_dev_password",
    bucket: process.env.MINIO_BUCKET ?? "evidence",
    useSSL: process.env.MINIO_USE_SSL === "true",
  },
};
