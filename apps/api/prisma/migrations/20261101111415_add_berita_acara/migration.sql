-- CreateEnum
CREATE TYPE "BeritaAcaraStatus" AS ENUM ('DRAFT', 'TERBIT', 'ARSIP');

-- CreateTable
CREATE TABLE "berita_acara" (
    "id" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "ringkasan" TEXT NOT NULL,
    "isi" TEXT NOT NULL,
    "fotoUrl" TEXT,
    "status" "BeritaAcaraStatus" NOT NULL DEFAULT 'DRAFT',
    "penulisId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "berita_acara_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "berita_acara_status_publishedAt_idx" ON "berita_acara"("status", "publishedAt");

-- AddForeignKey
ALTER TABLE "berita_acara" ADD CONSTRAINT "berita_acara_penulisId_fkey" FOREIGN KEY ("penulisId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
