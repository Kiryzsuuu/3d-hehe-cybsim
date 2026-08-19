"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface StoredUser {
  id: string;
  email: string;
  username: string;
}

function readStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("cybersim_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function storeSession(token: string, user: StoredUser) {
  localStorage.setItem("cybersim_token", token);
  localStorage.setItem("cybersim_user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("cybersim_token");
  localStorage.removeItem("cybersim_user");
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cybersim_token");
}

// Redirects to /login if there's no session. Returns the current user once
// the check has run (ready === true) so pages can avoid flashing protected
// content before the redirect kicks in.
export function useRequireAuth() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setUser(readStoredUser());
    setReady(true);
  }, [router]);

  return { ready, user };
}
