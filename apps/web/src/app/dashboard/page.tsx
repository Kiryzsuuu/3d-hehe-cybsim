"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { listProgress, type ProgressEntry } from "@/lib/api";

// xterm pulls in a non-trivial bundle — lazy-load and skip SSR since it touches window/DOM.
const TerminalPanel = dynamic(() => import("@/components/terminal/Terminal"), {
  ssr: false,
  loading: () => <div className="h-96 w-full rounded-lg border border-gray-800 bg-black" />,
});

const STATUS_LABEL: Record<string, string> = {
  in_progress: "Sedang berjalan",
  completed: "Selesai",
};

export default function DashboardPage() {
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listProgress()
      .then((res) => setProgress(res.progress))
      .catch(() => setProgress([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex gap-2">
          <Link
            href="/dashboard/scenarios"
            className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:border-accent hover:text-accent"
          >
            Skenario →
          </Link>
          <Link
            href="/dashboard/network"
            className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:border-accent hover:text-accent"
          >
            Network Topology →
          </Link>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm uppercase tracking-wide text-gray-500">Terminal</h2>
          <TerminalPanel />
        </section>
        <section>
          <h2 className="mb-2 text-sm uppercase tracking-wide text-gray-500">Progress</h2>
          {loading && <div className="rounded-lg border border-gray-800 p-4 text-sm text-gray-500">Memuat...</div>}
          {!loading && progress.length === 0 && (
            <div className="rounded-lg border border-gray-800 p-4 text-sm text-gray-400">
              Belum ada skenario aktif.{" "}
              <Link href="/dashboard/scenarios" className="text-accent">
                Mulai misi pertama Anda
              </Link>{" "}
              dari daftar skenario.
            </div>
          )}
          <div className="flex flex-col gap-2">
            {progress.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-800 p-3 text-sm">
                <div>
                  <div className="font-medium">{p.scenario.title}</div>
                  <div className="text-xs text-gray-500">{STATUS_LABEL[p.status] ?? p.status}</div>
                </div>
                <div className="text-accent">{p.score} pts</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
