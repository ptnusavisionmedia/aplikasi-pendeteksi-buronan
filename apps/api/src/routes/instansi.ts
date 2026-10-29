import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../services/prisma";

export const instansiRouter = Router();

instansiRouter.get("/", requireAuth, async (_req, res) => {
  const instansi = await prisma.instansi.findMany({
    select: { id: true, nama: true, jenis: true, wilayah: true },
    orderBy: { nama: "asc" },
  });
  res.json(instansi);
});
