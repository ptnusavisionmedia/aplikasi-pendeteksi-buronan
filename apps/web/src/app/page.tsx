"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

export default function Home() {
  const router = useRouter();
  const { token, user } = useAuthStore();

  useEffect(() => {
    router.replace(token && user ? "/dashboard" : "/login");
  }, [token, user, router]);

  return null;
}
