"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRequireAuth } from "@/hooks/useAuth";
import AppHeader from "@/components/layout/AppHeader";

const NetworkRoom = dynamic(() => import("@/components/world/NetworkRoom"), {
  ssr: false,
  loading: () => <div className="h-[36rem] w-full rounded-lg border border-gray-800 bg-black" />,
});

export default function NetworkRoomPage() {
  const { ready } = useRequireAuth();
  if (!ready) return null;

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <AppHeader />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ruang Server Fisik</h1>
          <p className="text-sm text-gray-500">Jalan langsung ke rak dan sambungkan kabel dengan tangan Anda sendiri (FPV).</p>
        </div>
        <Link href="/world" className="text-sm text-gray-500 hover:text-accent">
          ← Kembali ke World
        </Link>
      </div>
      <NetworkRoom />
    </main>
  );
}
