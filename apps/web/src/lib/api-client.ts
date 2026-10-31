import axios from "axios";
import { useAuthStore } from "@/store/auth-store";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // Without this, a request that hangs upstream (MediaMTX/detection-engine stalling on a bad
  // camera) hangs here too — nothing ever rejects, so a UI like the CCTV list's auto "Cek
  // Koneksi" gets stuck showing "Menghubungkan..." forever instead of eventually erroring out.
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export function apiErrorMessage(error: unknown, fallback = "Terjadi kesalahan, coba lagi."): string {
  if (axios.isAxiosError(error)) {
    if (error.code === "ECONNABORTED") {
      return "Waktu permintaan habis — server tidak kunjung merespons. Coba lagi sesaat lagi.";
    }
    if (!error.response) {
      return "Tidak bisa menghubungi server — periksa koneksi jaringan Anda.";
    }
    const data = error.response?.data as { error?: unknown } | undefined;
    if (typeof data?.error === "string") return data.error;
    if (data?.error && typeof data.error === "object") {
      const flat = data.error as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
      const fieldMsg = flat.fieldErrors ? Object.values(flat.fieldErrors).flat()[0] : undefined;
      return fieldMsg ?? flat.formErrors?.[0] ?? fallback;
    }
  }
  return fallback;
}
