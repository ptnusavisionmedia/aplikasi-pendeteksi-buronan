"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { Field, Input, PrimaryButton, ErrorText, SuccessText } from "@/components/form";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await apiClient.post("/auth/forgot-password", { email });
      setSuccess(data.message);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-[18px] font-extrabold tracking-tight">Lupa password</h1>
        <p className="text-muted text-[12.5px] mt-1">Kami akan mengirim link reset ke email Anda.</p>
      </div>
      <ErrorText>{error}</ErrorText>
      <SuccessText>{success}</SuccessText>
      <Field label="Email">
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" />
      </Field>
      <PrimaryButton type="submit" disabled={loading}>
        <Mail className="w-4 h-4" />
        {loading ? "Mengirim..." : "Kirim link reset"}
      </PrimaryButton>
      <p className="text-[12.5px] text-muted text-center">
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Kembali ke login
        </Link>
      </p>
    </form>
  );
}
