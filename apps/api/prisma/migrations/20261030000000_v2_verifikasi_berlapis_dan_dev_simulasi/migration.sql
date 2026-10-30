-- PRD v2: Verifikasi Berlapis & Anti-Salah-Identifikasi + Mode Simulasi Webcam (Dev)
-- FR-19..FR-25. Hand-written (no live Postgres available in this environment to run
-- `prisma migrate dev` / `migrate diff`); apply with `pnpm --filter api prisma:migrate deploy`
-- once infra is up, then verify with `prisma migrate status`.

-- AlterEnum: new DetectionEvent lifecycle states (FR-19)
ALTER TYPE "DetectionStatus" ADD VALUE 'PENDING_CONFIRMATION';
ALTER TYPE "DetectionStatus" ADD VALUE 'CONFIRMED_BY_OFFICER';
ALTER TYPE "DetectionStatus" ADD VALUE 'REJECTED_FALSE_POSITIVE';

-- CreateEnum
CREATE TYPE "CCTVFeedSourceType" AS ENUM ('PRODUCTION', 'DEV_SIMULATION');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('MENUNGGU', 'DITERIMA', 'DITOLAK');

-- CreateEnum
CREATE TYPE "FotoAngle" AS ENUM ('FRONTAL', 'SAMPING_KIRI', 'SAMPING_KANAN');

-- AlterTable: Buronan (FR-21 quality gate flag)
ALTER TABLE "buronan" ADD COLUMN "enrollmentComplete" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: FotoBuronan (FR-21 multi-angle + quality metadata)
ALTER TABLE "foto_buronan" ADD COLUMN "angle" "FotoAngle" NOT NULL DEFAULT 'FRONTAL';
ALTER TABLE "foto_buronan" ADD COLUMN "width" INTEGER;
ALTER TABLE "foto_buronan" ADD COLUMN "height" INTEGER;

-- AlterTable: CCTVFeed (FR-24/FR-25 dev simulation isolation)
ALTER TABLE "cctv_feeds" ADD COLUMN "sourceType" "CCTVFeedSourceType" NOT NULL DEFAULT 'PRODUCTION';

-- AlterTable: DetectionEvent (FR-19 confirmation gate, FR-20 liveness flag)
ALTER TABLE "detection_events" ADD COLUMN "isLive" BOOLEAN;
ALTER TABLE "detection_events" ADD COLUMN "confirmedById" TEXT;
ALTER TABLE "detection_events" ADD COLUMN "confirmedAt" TIMESTAMP(3);
ALTER TABLE "detection_events" ADD COLUMN "rejectionReason" TEXT;

-- AddForeignKey
ALTER TABLE "detection_events" ADD CONSTRAINT "detection_events_confirmedById_fkey"
  FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: Appeal (FR-23 kanal sanggahan)
CREATE TABLE "appeals" (
    "id" TEXT NOT NULL,
    "detectionEventId" TEXT NOT NULL,
    "namaPengaju" TEXT NOT NULL,
    "kontakPengaju" TEXT NOT NULL,
    "buktiUrl" TEXT,
    "deskripsi" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'MENUNGGU',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "catatanReview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appeals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appeals_status_idx" ON "appeals"("status");

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_detectionEventId_fkey"
  FOREIGN KEY ("detectionEventId") REFERENCES "detection_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
