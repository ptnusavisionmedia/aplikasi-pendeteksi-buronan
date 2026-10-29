"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, Search } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { Field, Input, PrimaryButton, ErrorText, Badge } from "@/components/form";

interface PublicReportStatus {
  ticketId: string;
  status: string;
  createdAt: string;
  verifiedAt: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  MENUNGGU_VERIFIKASI: "Menunggu verifikasi petugas",
  VALID: "Terverifikasi valid",
  TIDAK_VALID: "Tidak valid",
  INVESTIGASI_LANJUTAN: "Investigasi lanjutan",
};

function StatusForm() {
  const searchParams = useSearchParams();
  const [ticketId, setTicketId] = useState(searchParams.get("ticketId") ?? "");
  const [result, setResult] = useState<PublicReportStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchStatus(id: string) {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const { data } = await apiClient.get<PublicReportStatus>(`/reports/${id}`);
      setResult(data);
    } catch (err) {
      setError(apiErrorMessage(err, "Laporan tidak ditemukan"));
    } finally {
      setLoading(false);
    }
  }

  function checkStatus(e: React.FormEvent) {
    e.preventDefault();
    fetchStatus(ticketId);
  }

  useEffect(() => {
    const initial = searchParams.get("ticketId");
    if (initial) fetchStatus(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center gap-2.5 mb-6 justify-center">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white">
            <ShieldAlert className="w-[20px] h-[20px]" />
          </div>
          <span className="font-extrabold text-[17px] tracking-tight">Sigap Buronan</span>
        </div>

        <div className="bento-cell shadow-card">
          <form onSubmit={checkStatus} className="flex flex-col gap-4">
            <div>
              <h1 className="text-[18px] font-extrabold tracking-tight">Cek Status Laporan</h1>
              <p className="text-muted text-[12.5px] mt-1">Masukkan nomor tiket yang Anda terima saat melapor.</p>
            </div>
            <ErrorText>{error}</ErrorText>
            <Field label="Nomor tiket">
              <Input required value={ticketId} onChange={(e) => setTicketId(e.target.value)} placeholder="contoh: clxk2j..." />
            </Field>
            <PrimaryButton type="submit" disabled={loading}>
              <Search className="w-4 h-4" />
              {loading ? "Mencari..." : "Cek Status"}
            </PrimaryButton>
          </form>

          {result && (
            <div className="mt-5 pt-5 border-t border-line flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-muted">Tiket #{result.ticketId}</span>
                <Badge tone={result.status === "VALID" ? "primary" : result.status === "TIDAK_VALID" ? "coral" : "amber"}>
                  {STATUS_LABEL[result.status] ?? result.status}
                </Badge>
              </div>
              <div className="text-[12px] text-muted">Dilaporkan: {new Date(result.createdAt).toLocaleString("id-ID")}</div>
              {result.verifiedAt && (
                <div className="text-[12px] text-muted">Diverifikasi: {new Date(result.verifiedAt).toLocaleString("id-ID")}</div>
              )}
            </div>
          )}

          <p className="text-[12.5px] text-muted text-center mt-5">
            <Link href="/lapor" className="font-semibold text-primary hover:underline">
              Buat laporan baru
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function StatusPage() {
  return (
    <Suspense>
      <StatusForm />
    </Suspense>
  );
}
