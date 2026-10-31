-- AlterTable
ALTER TABLE "cctv_feeds" ADD COLUMN     "onvifPort" INTEGER NOT NULL DEFAULT 80,
ADD COLUMN     "ptzSupported" BOOLEAN NOT NULL DEFAULT false;
