import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { writeAuditLog } from "../services/audit-log";
import { deleteEmbeddings, enrollFace } from "../services/detection-engine-client";
import { isEnrollmentComplete, validatePhotoQuality } from "../services/photo-quality";
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

    // instansiPenerbitId is a required FK (every Buronan must have a publishing agency), so an
    // account with no instansiId (e.g. a system-wide ADMIN not tied to one Instansi) can't create
    // one here — reject clearly instead of letting Prisma's FK violation crash the request as an
    // unhandled rejection (Express 4 doesn't catch async-handler throws on its own).
    if (!req.user!.instansiId) {
      return res.status(422).json({
        error: "Akun Anda tidak terhubung ke satu instansi, jadi tidak bisa menerbitkan data buronan. Hubungi admin untuk menautkan akun ke instansi.",
      });
    }

    const buronan = await prisma.buronan.create({
      data: {
        ...parsed.data,
        instansiPenerbitId: req.user!.instansiId,
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

buronanRouter.delete(
  "/:id",
  requireAuth,
  requireRole("ADMIN", "INSTANSI_HUKUM"),
  async (req, res) => {
    const buronan = await prisma.buronan.findUnique({
      where: { id: req.params.id },
      include: { fotos: true },
    });
    if (!buronan) return res.status(404).json({ error: "Buronan tidak ditemukan" });

    // foto_buronan.buronanId is a required FK (ON DELETE RESTRICT), so the photos have to go
    // first — in a transaction with the buronan itself, so a failure midway leaves nothing
    // half-deleted. detection_events.buronanId is nullable (ON DELETE SET NULL), so past
    // detection history stays intact, just no longer attributed to this buronan.
    await prisma.$transaction([
      prisma.fotoBuronan.deleteMany({ where: { buronanId: buronan.id } }),
      prisma.buronan.delete({ where: { id: buronan.id } }),
    ]);

    const pointIds = buronan.fotos.map((f) => f.qdrantPointId).filter((id): id is string => !!id);
    await deleteEmbeddings(pointIds).catch((err) =>
      console.error(`Gagal menghapus embedding wajah untuk buronan ${buronan.id}:`, err)
    );

    await writeAuditLog({
      userId: req.user!.id,
      action: "DELETE_BURONAN",
      entityType: "Buronan",
      entityId: buronan.id,
      detail: { nama: buronan.nama, nomorKasus: buronan.nomorKasus },
    });

    res.status(204).end();
  }
);

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

const fotoMetadataSchema = z.object({
  isPrimary: z.coerce.boolean().optional(),
  angle: z.enum(["FRONTAL", "SAMPING_KIRI", "SAMPING_KANAN"]).default("FRONTAL"),
  width: z.coerce.number().int().positive(),
  height: z.coerce.number().int().positive(),
});

buronanRouter.post(
  "/:id/foto",
  requireAuth,
  requireRole("ADMIN", "INSTANSI_HUKUM"),
  upload.single("foto"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "File foto wajib diunggah" });

    const parsedMeta = fotoMetadataSchema.safeParse(req.body);
    if (!parsedMeta.success) return res.status(400).json({ error: parsedMeta.error.flatten() });

    // FR-21: quality gate — resolusi minimum sebelum foto dipakai untuk vector embedding.
    const quality = validatePhotoQuality(parsedMeta.data);
    if (!quality.valid) return res.status(422).json({ error: quality.reason });

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
        isPrimary: parsedMeta.data.isPrimary ?? false,
        angle: parsedMeta.data.angle,
        width: parsedMeta.data.width,
        height: parsedMeta.data.height,
      },
    });

    // FR-21: mandatory multi-angle — mark enrollment complete once >= 2 distinct angles are on file.
    const allFotos = await prisma.fotoBuronan.findMany({
      where: { buronanId: buronan.id },
      select: { angle: true },
    });
    const enrollmentComplete = isEnrollmentComplete(allFotos);
    if (enrollmentComplete !== buronan.enrollmentComplete) {
      await prisma.buronan.update({ where: { id: buronan.id }, data: { enrollmentComplete } });
    }

    await writeAuditLog({
      userId: req.user!.id,
      action: "ADD_BURONAN_FOTO",
      entityType: "Buronan",
      entityId: buronan.id,
      detail: { angle: parsedMeta.data.angle, enrollmentComplete },
    });

    res.status(201).json({ ...foto, enrollmentComplete });
  }
);
