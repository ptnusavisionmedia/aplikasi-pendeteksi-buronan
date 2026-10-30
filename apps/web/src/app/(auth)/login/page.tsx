"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn, Eye, EyeOff } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { Field, Input, PrimaryButton, ErrorText, Checkbox } from "@/components/form";

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await apiClient.post("/auth/login", { email, password });
      if (data.requiresOtp) {
        sessionStorage.setItem("pendingToken", data.pendingToken);
        sessionStorage.setItem("pendingRememberMe", String(rememberMe));
        router.push("/login/verify-otp");
        return;
      }
      const me = await apiClient.get("/auth/me", { headers: { Authorization: `Bearer ${data.token}` } });
      setSession(data.token, me.data, rememberMe);
      router.push("/dashboard");
    } catch (err) {
      setError(apiErrorMessage(err, "Email atau password salah"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-[18px] font-extrabold tracking-tight">Masuk ke akun Anda</h1>
        <p className="text-muted text-[12.5px] mt-1">Gunakan email &amp; password terdaftar.</p>
      </div>
      <ErrorText>{error}</ErrorText>
      <Field label="Email">
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@instansi.go.id" />
      </Field>
      <Field label="Password">
        <div className="relative w-full">
          <Input
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
            aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </Field>
      <div className="flex items-center justify-between -mt-2">
        <label className="flex items-center gap-2 text-[12.5px] font-semibold text-muted cursor-pointer">
          <Checkbox checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
          Ingat saya
        </label>
        <Link href="/forgot-password" className="text-[12.5px] font-semibold text-primary hover:underline">
          Lupa password?
        </Link>
      </div>
      <PrimaryButton type="submit" disabled={loading}>
        <LogIn className="w-4 h-4" />
        {loading ? "Memproses..." : "Masuk"}
      </PrimaryButton>
      <p className="text-[12.5px] text-muted text-center">
        Dashboard ini khusus petugas berwenang. Akun dibuat oleh operator — hubungi admin jika belum punya akun.
      </p>
    </form>
  );
}
