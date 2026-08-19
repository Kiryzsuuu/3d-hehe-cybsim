"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRequireAuth } from "@/hooks/useAuth";
import AppHeader from "@/components/layout/AppHeader";

const CtfTerminalRoom = dynamic(() => import("@/components/world/CtfTerminalRoom"), {
  ssr: false,
  loading: () => <div className="h-[36rem] w-full rounded-lg border border-gray-800 bg-black" />,
});

export default function CtfTerminalPage() {
  const { ready } = useRequireAuth();
  if (!ready) return null;

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <AppHeader />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Terminal CTF</h1>
          <p className="text-sm text-gray-500">Jalan ke terminal fisik dan retas sungguhan untuk menemukan flag.</p>
        </div>
        <Link href="/world" className="text-sm text-gray-500 hover:text-accent">
          ← Kembali ke World
        </Link>
      </div>
      <CtfTerminalRoom />
    </main>
  );
}
