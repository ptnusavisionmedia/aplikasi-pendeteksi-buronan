"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { Field, Input, PrimaryButton, ErrorText } from "@/components/form";

export default function VerifyOtpPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("pendingToken");
    if (!token) {
      router.replace("/login");
      return;
    }
    setPendingToken(token);
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingToken) return;
    setError(null);
    setLoading(true);
    try {
      const { data } = await apiClient.post("/auth/login/verify-otp", { pendingToken, otp });
      const me = await apiClient.get("/auth/me", { headers: { Authorization: `Bearer ${data.token}` } });
      const rememberMe = sessionStorage.getItem("pendingRememberMe") !== "false";
      setSession(data.token, me.data, rememberMe);
      sessionStorage.removeItem("pendingToken");
      sessionStorage.removeItem("pendingRememberMe");
      router.push("/dashboard");
    } catch (err) {
      setError(apiErrorMessage(err, "Kode OTP salah atau kedaluwarsa"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-[18px] font-extrabold tracking-tight">Verifikasi Dua Faktor</h1>
        <p className="text-muted text-[12.5px] mt-1">Masukkan 6 digit kode dari aplikasi autentikator Anda.</p>
      </div>
      <ErrorText>{error}</ErrorText>
      <Field label="Kode OTP">
        <Input
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="000000"
          className="tabular tracking-[0.3em] text-center text-[16px]"
        />
      </Field>
      <PrimaryButton type="submit" disabled={loading || !pendingToken}>
        <ShieldCheck className="w-4 h-4" />
        {loading ? "Memverifikasi..." : "Verifikasi"}
      </PrimaryButton>
    </form>
  );
}
