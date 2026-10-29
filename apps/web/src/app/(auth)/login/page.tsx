"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { Field, Input, PrimaryButton, ErrorText } from "@/components/form";

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        router.push("/login/verify-otp");
        return;
      }
      const me = await apiClient.get("/auth/me", { headers: { Authorization: `Bearer ${data.token}` } });
      setSession(data.token, me.data);
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
        <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </Field>
      <div className="flex justify-end -mt-2">
        <Link href="/forgot-password" className="text-[12.5px] font-semibold text-primary hover:underline">
          Lupa password?
        </Link>
      </div>
      <PrimaryButton type="submit" disabled={loading}>
        <LogIn className="w-4 h-4" />
        {loading ? "Memproses..." : "Masuk"}
      </PrimaryButton>
      <p className="text-[12.5px] text-muted text-center">
        Belum punya akun?{" "}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          Daftar
        </Link>
      </p>
    </form>
  );
}
