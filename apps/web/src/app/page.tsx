"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStoredToken } from "@/hooks/useAuth";

export default function LandingPage() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    setLoggedIn(!!getStoredToken());
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight">
        🛡️ Cyber<span className="text-accent">Sim</span>
      </h1>
      <p className="max-w-xl text-gray-400">
        Network & Cyber Security Simulator: jelajahi topologi jaringan interaktif, kuasai terminal CLI,
        latih diri lewat sandbox DVWA, dan selesaikan misi CTF berjenjang.
      </p>
      <div className="flex gap-4">
        {loggedIn === null ? null : loggedIn ? (
          <Link href="/dashboard" className="rounded-md bg-accent px-5 py-2 font-medium text-black hover:opacity-90">
            Ke Dashboard
          </Link>
        ) : (
          <>
            <Link href="/register" className="rounded-md bg-accent px-5 py-2 font-medium text-black hover:opacity-90">
              Daftar
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-gray-700 px-5 py-2 font-medium text-gray-300 hover:border-accent hover:text-accent"
            >
              Login
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
