import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { writeAuditLog } from "../services/audit-log";
import { enrollFace } from "../services/detection-engine-client";
import { prisma } from "../services/prisma";
import { uploadEvidenceFile } from "../services/storage";

export const buronanRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const createBuronanSchema = z.object({
  nama: z.string().min(1),
  nik: z.string().optional(),
  nomorKasus: z.string().min(1),
  tingkatAncaman: z.enum(["Tinggi", "Sedang", "Rendah"]),
});

buronanRouter.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "INSTANSI_HUKUM"),
  async (req, res) => {
    const parsed = createBuronanSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const buronan = await prisma.buronan.create({
      data: {
        ...parsed.data,
        instansiPenerbitId: req.user!.instansiId ?? "",
      },
    });

    await writeAuditLog({
      userId: req.user!.id,
      action: "CREATE_BURONAN",
      entityType: "Buronan",
      entityId: buronan.id,
    });

    res.status(201).json(buronan);
  }
);

buronanRouter.get("/", requireAuth, async (req, res) => {
  const { q, status } = req.query as { q?: string; status?: string };

  const buronan = await prisma.buronan.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(q
        ? {
            OR: [
              { nama: { contains: q, mode: "insensitive" } },
              { nomorKasus: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { fotos: { where: { isPrimary: true }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  res.json(buronan);
});

buronanRouter.get("/:id", requireAuth, async (req, res) => {
  const buronan = await prisma.buronan.findUnique({
    where: { id: req.params.id },
    include: { fotos: true, detectionEvents: { orderBy: { detectedAt: "desc" }, take: 20 } },
  });
  if (!buronan) return res.status(404).json({ error: "Buronan tidak ditemukan" });
  res.json(buronan);
});

const updateStatusSchema = z.object({
  status: z.enum(["DPO_AKTIF", "TERTANGKAP", "DICABUT"]),
});

buronanRouter.patch(
  "/:id/status",
  requireAuth,
  requireRole("ADMIN", "INSTANSI_HUKUM"),
  async (req, res) => {
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const buronan = await prisma.buronan.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status },
    });

    await writeAuditLog({
      userId: req.user!.id,
      action: "UPDATE_BURONAN_STATUS",
      entityType: "Buronan",
      entityId: buronan.id,
      detail: parsed.data,
    });

    res.json(buronan);
  }
);

buronanRouter.post(
  "/:id/foto",
  requireAuth,
  requireRole("ADMIN", "INSTANSI_HUKUM"),
  upload.single("foto"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "File foto wajib diunggah" });

    const buronan = await prisma.buronan.findUnique({ where: { id: req.params.id } });
    if (!buronan) return res.status(404).json({ error: "Buronan tidak ditemukan" });

    const fotoUrl = await uploadEvidenceFile(req.file.buffer, req.file.originalname, req.file.mimetype);

    let qdrantPointId: string | undefined;
    try {
      const enrollResult = await enrollFace({ buronanId: buronan.id, fotoUrl });
      qdrantPointId = enrollResult.qdrantPointId;
    } catch (err) {
      return res.status(422).json({ error: `Gagal memproses foto: ${(err as Error).message}` });
    }

    const foto = await prisma.fotoBuronan.create({
      data: {
        buronanId: buronan.id,
        urlFoto: fotoUrl,
        qdrantPointId,
        isPrimary: req.body.isPrimary === "true",
      },
    });

    await writeAuditLog({
      userId: req.user!.id,
      action: "ADD_BURONAN_FOTO",
      entityType: "Buronan",
      entityId: buronan.id,
    });

    res.status(201).json(foto);
  }
);
