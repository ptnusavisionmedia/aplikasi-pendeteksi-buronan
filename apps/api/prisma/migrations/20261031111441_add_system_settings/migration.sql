-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "cctvAutoCheckIntervalSeconds" INTEGER NOT NULL DEFAULT 30,
    "liveDetectionPollIntervalMs" INTEGER NOT NULL DEFAULT 1200,
    "detectionReportThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "detectionMatchThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);
