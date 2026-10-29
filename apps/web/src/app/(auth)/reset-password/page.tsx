"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { Field, Input, PrimaryButton, ErrorText } from "@/components/form";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiClient.post("/auth/reset-password", { token, newPassword });
      router.push("/login");
    } catch (err) {
      setError(apiErrorMessage(err, "Token tidak valid atau kedaluwarsa"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-[18px] font-extrabold tracking-tight">Reset password</h1>
        <p className="text-muted text-[12.5px] mt-1">Masukkan token dari link reset dan password baru.</p>
      </div>
      <ErrorText>{error}</ErrorText>
      <Field label="Token reset">
        <Input required value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token dari email" />
      </Field>
      <Field label="Password baru">
        <Input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimal 8 karakter" />
      </Field>
      <PrimaryButton type="submit" disabled={loading}>
        <KeyRound className="w-4 h-4" />
        {loading ? "Memproses..." : "Ubah password"}
      </PrimaryButton>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
