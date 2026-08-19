"use client";

import dynamic from "next/dynamic";

// xterm pulls in a non-trivial bundle — lazy-load and skip SSR since it touches window/DOM.
const TerminalPanel = dynamic(() => import("@/components/terminal/Terminal"), {
  ssr: false,
  loading: () => <div className="h-96 w-full rounded-lg border border-gray-800 bg-black" />,
});

export default function DashboardPage() {
  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm uppercase tracking-wide text-gray-500">Terminal</h2>
          <TerminalPanel />
        </section>
        <section>
          <h2 className="mb-2 text-sm uppercase tracking-wide text-gray-500">Progress</h2>
          <div className="rounded-lg border border-gray-800 p-4 text-sm text-gray-400">
            Belum ada skenario aktif. Mulai misi pertama Anda dari daftar skenario.
          </div>
        </section>
      </div>
    </main>
  );
}
