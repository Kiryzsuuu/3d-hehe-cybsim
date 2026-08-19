"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { listProgress, type ProgressEntry } from "@/lib/api";
import { useRequireAuth } from "@/hooks/useAuth";
import AppHeader from "@/components/layout/AppHeader";

// xterm pulls in a non-trivial bundle — lazy-load and skip SSR since it touches window/DOM.
const TerminalPanel = dynamic(() => import("@/components/terminal/Terminal"), {
  ssr: false,
  loading: () => <div className="h-96 w-full rounded-lg border border-gray-800 bg-black" />,
});

const SandboxPanel = dynamic(() => import("@/components/sandbox/SandboxPanel"), {
  ssr: false,
  loading: () => <div className="h-32 w-full rounded-lg border border-gray-800" />,
});

const DvwaPanel = dynamic(() => import("@/components/sandbox/DvwaPanel"), {
  ssr: false,
  loading: () => <div className="h-32 w-full rounded-lg border border-gray-800" />,
});

const STATUS_LABEL: Record<string, string> = {
  in_progress: "Sedang berjalan",
  completed: "Selesai",
};

export default function DashboardPage() {
  const { ready, user } = useRequireAuth();
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTutorialBanner, setShowTutorialBanner] = useState(false);

  useEffect(() => {
    if (!ready) return;
    listProgress()
      .then((res) => setProgress(res.progress))
      .catch(() => setProgress([]))
      .finally(() => setLoading(false));

    if (!localStorage.getItem("cybersim_tutorial_seen")) {
      setShowTutorialBanner(true);
    }
  }, [ready]);

  const dismissTutorialBanner = () => {
    localStorage.setItem("cybersim_tutorial_seen", "1");
    setShowTutorialBanner(false);
  };

  if (!ready) return null;

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <AppHeader />

      {showTutorialBanner && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent bg-cyan-950/20 p-4">
          <p className="text-sm text-gray-200">
            Baru pertama kali main? Cek Tutorial untuk panduan singkat semua fitur.
          </p>
          <div className="flex gap-2">
            <Link
              href="/tutorial"
              onClick={dismissTutorialBanner}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-black"
            >
              Lihat Tutorial
            </Link>
            <button
              onClick={dismissTutorialBanner}
              className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:text-gray-100"
            >
              Nanti saja
            </button>
          </div>
        </div>
      )}

      <h1 className="mb-6 text-2xl font-semibold">
        Selamat datang, <span className="text-accent">{user?.username}</span>
      </h1>
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

          <h2 className="mb-2 mt-6 text-sm uppercase tracking-wide text-gray-500">Sandbox</h2>
          <SandboxPanel />

          <h2 className="mb-2 mt-6 text-sm uppercase tracking-wide text-gray-500">DVWA Target</h2>
          <DvwaPanel />
        </section>
      </div>
    </main>
  );
}
