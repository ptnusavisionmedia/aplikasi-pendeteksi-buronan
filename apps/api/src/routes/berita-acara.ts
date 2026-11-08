import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { writeAuditLog } from "../services/audit-log";
import { broadcastNotification } from "../services/notifications";
import { prisma } from "../services/prisma";
import { uploadEvidenceFile } from "../services/storage";
import { parsePagination, paginatedResult } from "../lib/pagination";

export const beritaAcaraRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const OFFICER_ROLES = ["ADMIN", "APARAT", "KEAMANAN_SWASTA"] as const;

// A staff user (any authenticated non-MASYARAKAT role) also sees DRAFT/ARSIP items in the list
// and detail — req.user is only populated when a token was sent, via optionalAuth upstream.
function canSeeUnpublished(role?: string) {
  return !!role && role !== "MASYARAKAT";
}

const listQuerySchema = z.object({
  status: z.enum(["DRAFT", "TERBIT", "ARSIP", "ALL"]).optional(),
  q: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

beritaAcaraRouter.get("/", optionalAuth, async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const staffView = canSeeUnpublished(req.user?.role);
  const status = parsed.data.status ?? (staffView ? "ALL" : "TERBIT");
  if (!staffView && status !== "TERBIT") return res.status(403).json({ error: "Forbidden" });

  const pagination = parsePagination(req.query as Record<string, unknown>);
  const where = {
    ...(status === "ALL" ? {} : { status }),
    ...(parsed.data.q
      ? {
          OR: [
            { judul: { contains: parsed.data.q, mode: "insensitive" as const } },
            { ringkasan: { contains: parsed.data.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.beritaAcara.findMany({
      where,
      include: { penulis: { select: { id: true, nama: true } } },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.beritaAcara.count({ where }),
  ]);
  res.json(paginatedResult(items, total, pagination));
});

beritaAcaraRouter.get("/:id", optionalAuth, async (req, res) => {
  const item = await prisma.beritaAcara.findUnique({
    where: { id: req.params.id },
    include: { penulis: { select: { id: true, nama: true } } },
  });
  if (!item) return res.status(404).json({ error: "Berita acara tidak ditemukan" });
  if (item.status !== "TERBIT" && !canSeeUnpublished(req.user?.role)) {
    return res.status(404).json({ error: "Berita acara tidak ditemukan" });
  }
  res.json(item);
});

// Dipanggil tombol "Sisipkan Gambar" di editor markdown CMS — mengunggah satu gambar lepas
// (bukan foto sampul) dan mengembalikan URL-nya untuk disisipkan sebagai `![...](url)` di `isi`.
beritaAcaraRouter.post(
  "/media",
  requireAuth,
  requireRole(...OFFICER_ROLES),
  upload.single("file"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "File gambar wajib diisi" });
    const url = await uploadEvidenceFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.status(201).json({ url });
  }
);

const createSchema = z.object({
  judul: z.string().min(1),
  ringkasan: z.string().min(1),
  isi: z.string().min(1),
  status: z.enum(["DRAFT", "TERBIT", "ARSIP"]).optional(),
});

beritaAcaraRouter.post(
  "/",
  requireAuth,
  requireRole(...OFFICER_ROLES),
  upload.single("foto"),
  async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const fotoUrl = req.file ? await uploadEvidenceFile(req.file.buffer, req.file.originalname, req.file.mimetype) : undefined;
    const status = parsed.data.status ?? "DRAFT";

    const item = await prisma.beritaAcara.create({
      data: {
        judul: parsed.data.judul,
        ringkasan: parsed.data.ringkasan,
        isi: parsed.data.isi,
        fotoUrl,
        status,
        penulisId: req.user!.id,
        publishedAt: status === "TERBIT" ? new Date() : null,
      },
    });

    await writeAuditLog({
      userId: req.user!.id,
      action: "CREATE_BERITA_ACARA",
      entityType: "BeritaAcara",
      entityId: item.id,
      detail: { judul: item.judul, status: item.status },
    });

    if (item.status === "TERBIT") {
      await broadcastNotification({
        type: "BERITA_ACARA_BARU",
        title: "Berita Acara Baru",
        body: item.judul,
        beritaAcaraId: item.id,
      });
    }

    res.status(201).json(item);
  }
);

const updateSchema = z.object({
  judul: z.string().min(1).optional(),
  ringkasan: z.string().min(1).optional(),
  isi: z.string().min(1).optional(),
  status: z.enum(["DRAFT", "TERBIT", "ARSIP"]).optional(),
});

beritaAcaraRouter.patch(
  "/:id",
  requireAuth,
  requireRole(...OFFICER_ROLES),
  upload.single("foto"),
  async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const existing = await prisma.beritaAcara.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Berita acara tidak ditemukan" });

    const fotoUrl = req.file ? await uploadEvidenceFile(req.file.buffer, req.file.originalname, req.file.mimetype) : undefined;
    const becameTerbit = parsed.data.status === "TERBIT" && existing.status !== "TERBIT";

    const item = await prisma.beritaAcara.update({
      where: { id: req.params.id },
      data: {
        ...parsed.data,
        ...(fotoUrl ? { fotoUrl } : {}),
        ...(becameTerbit ? { publishedAt: new Date() } : {}),
      },
    });

    await writeAuditLog({
      userId: req.user!.id,
      action: "UPDATE_BERITA_ACARA",
      entityType: "BeritaAcara",
      entityId: item.id,
      detail: parsed.data,
    });

    if (becameTerbit) {
      await broadcastNotification({
        type: "BERITA_ACARA_BARU",
        title: "Berita Acara Baru",
        body: item.judul,
        beritaAcaraId: item.id,
      });
    }

    res.json(item);
  }
);

beritaAcaraRouter.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const existing = await prisma.beritaAcara.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Berita acara tidak ditemukan" });

  await prisma.beritaAcara.delete({ where: { id: existing.id } });

  await writeAuditLog({
    userId: req.user!.id,
    action: "DELETE_BERITA_ACARA",
    entityType: "BeritaAcara",
    entityId: existing.id,
    detail: { judul: existing.judul },
  });

  res.status(204).end();
});
