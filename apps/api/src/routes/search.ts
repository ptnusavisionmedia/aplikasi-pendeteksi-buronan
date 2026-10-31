import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../services/prisma";

export const searchRouter = Router();

export type SearchResultType = "buronan" | "cctv" | "deteksi";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const RESULTS_PER_CATEGORY = 5;

/** Backs the sidebar's global search box — one query fanned out across the entities operators
 * actually look things up by (buronan name/case number, camera name/location, detection events
 * by the buronan they matched). Each category is capped so the dropdown stays scannable instead
 * of becoming a second full-text search UI. */
searchRouter.get("/", requireAuth, async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q || q.length < 2) return res.json({ results: [] });

  const wilayahScope = req.user!.role === "ADMIN" ? undefined : req.user!.wilayahScope ?? undefined;

  const [buronan, cctvFeeds, detections] = await Promise.all([
    prisma.buronan.findMany({
      where: {
        OR: [{ nama: { contains: q, mode: "insensitive" } }, { nomorKasus: { contains: q, mode: "insensitive" } }],
      },
      take: RESULTS_PER_CATEGORY,
      orderBy: { createdAt: "desc" },
    }),
    prisma.cCTVFeed.findMany({
      where: {
        ...(wilayahScope ? { wilayah: wilayahScope } : {}),
        OR: [{ nama: { contains: q, mode: "insensitive" } }, { lokasi: { contains: q, mode: "insensitive" } }],
      },
      take: RESULTS_PER_CATEGORY,
      orderBy: { createdAt: "desc" },
    }),
    prisma.detectionEvent.findMany({
      where: { buronan: { nama: { contains: q, mode: "insensitive" } } },
      take: RESULTS_PER_CATEGORY,
      orderBy: { detectedAt: "desc" },
      include: { buronan: true, cctvFeed: true },
    }),
  ]);

  const results: SearchResult[] = [
    ...buronan.map((b): SearchResult => ({
      type: "buronan",
      id: b.id,
      title: b.nama,
      subtitle: `Kasus #${b.nomorKasus}`,
      href: `/buronan/${b.id}`,
    })),
    ...cctvFeeds.map((f): SearchResult => ({
      type: "cctv",
      id: f.id,
      title: f.nama,
      subtitle: f.lokasi,
      href: `/cctv`,
    })),
    ...detections.map((d): SearchResult => ({
      type: "deteksi",
      id: d.id,
      title: d.buronan?.nama ?? "Deteksi",
      subtitle: d.cctvFeed?.lokasi ?? "Upload manual",
      href: `/deteksi/${d.id}`,
    })),
  ];

  res.json({ results });
});
