-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'APARAT', 'KEAMANAN_SWASTA', 'INSTANSI_HUKUM', 'MASYARAKAT');

-- CreateEnum
CREATE TYPE "BuronanStatus" AS ENUM ('DPO_AKTIF', 'TERTANGKAP', 'DICABUT');

-- CreateEnum
CREATE TYPE "DetectionStatus" AS ENUM ('CONFIRMED', 'LOW_CONFIDENCE', 'MANUAL_CHECK');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('PUSH', 'SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "EscalationStatus" AS ENUM ('PENDING', 'DITINDAKLANJUTI', 'SELESAI');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('MENUNGGU_VERIFIKASI', 'VALID', 'TIDAK_VALID', 'INVESTIGASI_LANJUTAN');

-- CreateTable
CREATE TABLE "instansi" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "wilayah" TEXT NOT NULL,
    "statusVerifikasi" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instansi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "instansiId" TEXT,
    "wilayahScope" TEXT,
    "twoFactorSecret" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buronan" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "nik" TEXT,
    "nomorKasus" TEXT NOT NULL,
    "tingkatAncaman" TEXT NOT NULL,
    "status" "BuronanStatus" NOT NULL DEFAULT 'DPO_AKTIF',
    "instansiPenerbitId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buronan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foto_buronan" (
    "id" TEXT NOT NULL,
    "buronanId" TEXT NOT NULL,
    "urlFoto" TEXT NOT NULL,
    "qdrantPointId" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "foto_buronan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_feeds" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "lokasi" TEXT NOT NULL,
    "urlStream" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "wilayah" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instansiId" TEXT,

    CONSTRAINT "cctv_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detection_events" (
    "id" TEXT NOT NULL,
    "cctvFeedId" TEXT,
    "reportId" TEXT,
    "buronanId" TEXT,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "status" "DetectionStatus" NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detection_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "detectionEventId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "metadata" JSONB,
    "retentionUntil" TIMESTAMP(3) NOT NULL,
    "chainOfCustody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "detectionEventId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalations" (
    "id" TEXT NOT NULL,
    "detectionEventId" TEXT NOT NULL,
    "dibuatOlehId" TEXT NOT NULL,
    "instansiTujuanId" TEXT NOT NULL,
    "catatan" TEXT,
    "status" "EscalationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "pelaporId" TEXT,
    "fotoUrl" TEXT NOT NULL,
    "lokasi" TEXT NOT NULL,
    "deskripsi" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'MENUNGGU_VERIFIKASI',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "buronan_nomorKasus_key" ON "buronan"("nomorKasus");

-- CreateIndex
CREATE INDEX "buronan_status_idx" ON "buronan"("status");

-- CreateIndex
CREATE INDEX "cctv_feeds_wilayah_idx" ON "cctv_feeds"("wilayah");

-- CreateIndex
CREATE INDEX "detection_events_cctvFeedId_detectedAt_idx" ON "detection_events"("cctvFeedId", "detectedAt");

-- CreateIndex
CREATE INDEX "detection_events_buronanId_idx" ON "detection_events"("buronanId");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_detectionEventId_key" ON "evidence"("detectionEventId");

-- CreateIndex
CREATE UNIQUE INDEX "reports_ticketId_key" ON "reports"("ticketId");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_instansiId_fkey" FOREIGN KEY ("instansiId") REFERENCES "instansi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buronan" ADD CONSTRAINT "buronan_instansiPenerbitId_fkey" FOREIGN KEY ("instansiPenerbitId") REFERENCES "instansi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foto_buronan" ADD CONSTRAINT "foto_buronan_buronanId_fkey" FOREIGN KEY ("buronanId") REFERENCES "buronan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_feeds" ADD CONSTRAINT "cctv_feeds_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_feeds" ADD CONSTRAINT "cctv_feeds_instansiId_fkey" FOREIGN KEY ("instansiId") REFERENCES "instansi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_events" ADD CONSTRAINT "detection_events_cctvFeedId_fkey" FOREIGN KEY ("cctvFeedId") REFERENCES "cctv_feeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_events" ADD CONSTRAINT "detection_events_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_events" ADD CONSTRAINT "detection_events_buronanId_fkey" FOREIGN KEY ("buronanId") REFERENCES "buronan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_detectionEventId_fkey" FOREIGN KEY ("detectionEventId") REFERENCES "detection_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_detectionEventId_fkey" FOREIGN KEY ("detectionEventId") REFERENCES "detection_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_detectionEventId_fkey" FOREIGN KEY ("detectionEventId") REFERENCES "detection_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_dibuatOlehId_fkey" FOREIGN KEY ("dibuatOlehId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_instansiTujuanId_fkey" FOREIGN KEY ("instansiTujuanId") REFERENCES "instansi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_pelaporId_fkey" FOREIGN KEY ("pelaporId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
