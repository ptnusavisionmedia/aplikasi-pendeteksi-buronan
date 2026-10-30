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
  minio: {
    endpoint: process.env.MINIO_ENDPOINT ?? "localhost",
    port: Number(process.env.MINIO_PORT ?? 9000),
    accessKey: process.env.MINIO_ACCESS_KEY ?? "buronan",
    secretKey: process.env.MINIO_SECRET_KEY ?? "buronan_dev_password",
    bucket: process.env.MINIO_BUCKET ?? "evidence",
    useSSL: process.env.MINIO_USE_SSL === "true",
  },
};
