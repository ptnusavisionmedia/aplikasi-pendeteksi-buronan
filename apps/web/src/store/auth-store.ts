import { create } from "zustand";
import type { User } from "@/lib/types";

const STORAGE_KEY = "buronan-auth";

interface StoredSession {
  token: string;
  user: User;
}

interface AuthState {
  token: string | null;
  user: User | null;
  /** False until `hydrate()` has checked storage once — lets the dashboard layout hold off its
   * "not logged in, redirect to /login" decision until the real answer is known, instead of
   * reading the initial (always-null) in-memory state and bouncing a remembered session out. */
  hydrated: boolean;
  /** `rememberMe: true` (default) survives closing the browser (localStorage); `false` only
   * survives the current tab/session (sessionStorage) and is gone once that tab closes. */
  setSession: (token: string, user: User, rememberMe?: boolean) => void;
  logout: () => void;
  hydrate: () => void;
}

function readStored(): StoredSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>()((set) => ({
  token: null,
  user: null,
  hydrated: false,
  setSession: (token, user, rememberMe = true) => {
    const payload = JSON.stringify({ token, user } satisfies StoredSession);
    if (rememberMe) {
      window.localStorage.setItem(STORAGE_KEY, payload);
      window.sessionStorage.removeItem(STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(STORAGE_KEY, payload);
      window.localStorage.removeItem(STORAGE_KEY);
    }
    set({ token, user, hydrated: true });
  },
  logout: () => {
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
    set({ token: null, user: null });
  },
  hydrate: () => {
    const stored = readStored();
    set({ token: stored?.token ?? null, user: stored?.user ?? null, hydrated: true });
  },
}));
