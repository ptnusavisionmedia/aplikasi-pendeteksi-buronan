-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DETECTION_MATCH', 'BURONAN_BARU', 'BURONAN_TERTANGKAP', 'BERITA_ACARA_BARU');

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_detectionEventId_fkey";

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "beritaAcaraId" TEXT,
ADD COLUMN     "body" TEXT,
ADD COLUMN     "buronanId" TEXT,
ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "type" "NotificationType" NOT NULL DEFAULT 'DETECTION_MATCH',
ALTER COLUMN "detectionEventId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_detectionEventId_fkey" FOREIGN KEY ("detectionEventId") REFERENCES "detection_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_buronanId_fkey" FOREIGN KEY ("buronanId") REFERENCES "buronan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_beritaAcaraId_fkey" FOREIGN KEY ("beritaAcaraId") REFERENCES "berita_acara"("id") ON DELETE SET NULL ON UPDATE CASCADE;
