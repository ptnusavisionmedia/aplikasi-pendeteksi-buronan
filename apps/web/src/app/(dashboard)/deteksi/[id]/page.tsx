"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScanFace, Siren, Download, ExternalLink } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { Badge, Select, Textarea, PrimaryButton, ErrorText, SuccessText } from "@/components/form";
import type { DetectionEvent } from "@/lib/types";

interface Instansi {
  id: string;
  nama: string;
  jenis: string;
  wilayah: string;
}

export default function DetectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const canEscalate = user?.role === "ADMIN" || user?.role === "APARAT" || user?.role === "KEAMANAN_SWASTA";

  const { data: event } = useQuery({
    queryKey: ["detections", id],
    queryFn: async () => (await apiClient.get<DetectionEvent>(`/detections/${id}`)).data,
  });

  const { data: instansiList } = useQuery({
    queryKey: ["instansi"],
    enabled: canEscalate,
    queryFn: async () => (await apiClient.get<Instansi[]>("/instansi")).data,
  });

  const [instansiTujuanId, setInstansiTujuanId] = useState("");
  const [catatan, setCatatan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onEscalate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiClient.post("/escalations", { detectionEventId: id, instansiTujuanId, catatan: catatan || undefined });
      setSuccess("Eskalasi berhasil dibuat.");
      setCatatan("");
    } catch (err) {
      setError(apiErrorMessage(err, "Gagal membuat eskalasi"));
    } finally {
      setLoading(false);
    }
  }

  if (!event) return <p className="text-[13px] text-muted">Memuat data...</p>;

  const fotoUtama = event.buronan?.fotos?.find((f) => f.isPrimary) ?? event.buronan?.fotos?.[0];

  return (
    <div className="grid grid-cols-3 gap-5">
      <div className="bento-cell col-span-2 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {fotoUtama ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoUtama.urlFoto} alt={event.buronan?.nama ?? "Buronan"} className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-canvas flex items-center justify-center text-muted">
                <ScanFace className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="font-bold text-[15px]">{event.buronan?.nama ?? "Tidak dikenali"}</div>
              <div className="text-[12px] text-muted">{new Date(event.detectedAt).toLocaleString("id-ID")}</div>
            </div>
          </div>
          <Badge tone={event.status === "CONFIRMED" ? "coral" : event.status === "LOW_CONFIDENCE" ? "amber" : "muted"}>
            {event.status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-[12.5px]">
          <div className="bg-canvas rounded-xl px-3 py-2.5">
            <div className="text-muted">Confidence score</div>
            <div className="font-bold text-[16px] tabular">{Math.round(event.confidenceScore * 100)}%</div>
          </div>
          <div className="bg-canvas rounded-xl px-3 py-2.5">
            <div className="text-muted">Sumber</div>
            <div className="font-bold">{event.cctvFeed?.nama ?? "Upload manual"}</div>
          </div>
        </div>

        {event.buronan && (fotoUtama || event.evidence) && (
          <div>
            <div className="text-[12.5px] font-semibold mb-2">Perbandingan Wajah</div>
            <div className="grid grid-cols-2 gap-3">
              {fotoUtama && (
                <div>
                  <div className="text-[11px] text-muted mb-1">Foto buronan terdaftar</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fotoUtama.urlFoto} alt={event.buronan.nama} className="rounded-xl border border-line w-full aspect-square object-cover" />
                </div>
              )}
              {event.evidence && (
                <div>
                  <div className="text-[11px] text-muted mb-1">Tertangkap CCTV / evidence</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={event.evidence.fileUrl} alt="Evidence" className="rounded-xl border border-line w-full aspect-square object-cover" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2">
              {event.evidence && (
                <a
                  href={event.evidence.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary hover:underline"
                >
                  <Download className="w-3.5 h-3.5" /> Unduh evidence
                </a>
              )}
              {event.buronan && (
                <Link
                  href={`/buronan/${event.buronan.id}`}
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Lihat profil buronan
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {canEscalate && (
        <form onSubmit={onEscalate} className="bento-cell flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Siren className="w-4 h-4 text-coral" />
            <span className="font-bold text-[14px]">Buat Eskalasi</span>
          </div>
          <ErrorText>{error}</ErrorText>
          <SuccessText>{success}</SuccessText>
          {!event.evidence && <ErrorText>Eskalasi butuh evidence; belum tersedia untuk deteksi ini.</ErrorText>}
          <Select required value={instansiTujuanId} onChange={(e) => setInstansiTujuanId(e.target.value)}>
            <option value="">Pilih instansi tujuan</option>
            {instansiList?.map((i) => (
              <option key={i.id} value={i.id}>{i.nama} &middot; {i.wilayah}</option>
            ))}
          </Select>
          <Textarea rows={3} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan (opsional)" />
          <PrimaryButton type="submit" disabled={loading || !event.evidence}>
            {loading ? "Mengirim..." : "Kirim Eskalasi"}
          </PrimaryButton>
        </form>
      )}
    </div>
  );
}
