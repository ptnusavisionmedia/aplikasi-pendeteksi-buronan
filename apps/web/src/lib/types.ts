export type Role = "ADMIN" | "APARAT" | "KEAMANAN_SWASTA" | "INSTANSI_HUKUM" | "MASYARAKAT";

export type BuronanStatus = "DPO_AKTIF" | "TERTANGKAP" | "DICABUT";

export type DetectionStatus = "CONFIRMED" | "LOW_CONFIDENCE" | "MANUAL_CHECK";

export type EscalationStatus = "PENDING" | "DITINDAKLANJUTI" | "SELESAI";

export type ReportStatus = "MENUNGGU_VERIFIKASI" | "VALID" | "TIDAK_VALID" | "INVESTIGASI_LANJUTAN";

export interface User {
  id: string;
  email: string;
  nama: string;
  role: Role;
  instansiId: string | null;
  wilayahScope: string | null;
  isVerified: boolean;
}

export interface FotoBuronan {
  id: string;
  buronanId: string;
  urlFoto: string;
  qdrantPointId: string | null;
  isPrimary: boolean;
}

export interface Buronan {
  id: string;
  nama: string;
  nik: string | null;
  nomorKasus: string;
  tingkatAncaman: string;
  status: BuronanStatus;
  instansiPenerbitId: string;
  createdAt: string;
  fotos?: FotoBuronan[];
}

export interface CctvFeed {
  id: string;
  nama: string;
  lokasi: string;
  lat?: number | null;
  lng?: number | null;
  urlStream: string;
  ownerId: string;
  wilayah: string;
  status: string;
  ptzSupported: boolean;
  onvifPort: number;
  createdAt: string;
}

export interface Evidence {
  id: string;
  detectionEventId: string;
  fileUrl: string;
  retentionUntil: string;
  createdAt: string;
}

export interface DetectionEvent {
  id: string;
  cctvFeedId: string | null;
  reportId: string | null;
  buronanId: string | null;
  confidenceScore: number;
  status: DetectionStatus;
  detectedAt: string;
  buronan?: Buronan | null;
  cctvFeed?: CctvFeed | null;
  evidence?: Evidence | null;
}

export interface Notification {
  id: string;
  userId: string;
  detectionEventId: string;
  channel: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
  detectionEvent?: DetectionEvent;
}

export interface Escalation {
  id: string;
  detectionEventId: string;
  dibuatOlehId: string;
  instansiTujuanId: string;
  catatan: string | null;
  status: EscalationStatus;
  createdAt: string;
  detectionEvent?: DetectionEvent;
}

export interface Report {
  id: string;
  ticketId: string;
  pelaporId: string | null;
  fotoUrl: string;
  lokasi: string;
  deskripsi: string | null;
  status: ReportStatus;
  verifiedAt: string | null;
  createdAt: string;
  detectionEvents?: DetectionEvent[];
}
