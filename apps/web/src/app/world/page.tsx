"use client";

import dynamic from "next/dynamic";
import { useRequireAuth } from "@/hooks/useAuth";
import AppHeader from "@/components/layout/AppHeader";

// Three.js + drei pull in a heavy bundle — lazy-load and skip SSR since Canvas needs WebGL/DOM.
const WorldExplorer = dynamic(() => import("@/components/world/WorldExplorer"), {
  ssr: false,
  loading: () => <div className="h-[36rem] w-full rounded-lg border border-gray-800 bg-black" />,
});

export default function WorldPage() {
  const { ready } = useRequireAuth();
  if (!ready) return null;

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <AppHeader />
      <h1 className="mb-2 text-2xl font-semibold">World</h1>
      <p className="mb-6 text-sm text-gray-500">
        Jalan-jalan di peta dan dekati sebuah stasiun untuk masuk ke fiturnya.
      </p>
      <WorldExplorer />
    </main>
  );
}
