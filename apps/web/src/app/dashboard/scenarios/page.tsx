"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listScenarios, listProgress, type ScenarioSummary, type ProgressEntry } from "@/lib/api";
import { useRequireAuth } from "@/hooks/useAuth";
import AppHeader from "@/components/layout/AppHeader";

const LEVEL_COLOR: Record<string, string> = {
  beginner: "text-green-400 border-green-800",
  intermediate: "text-yellow-400 border-yellow-800",
  advanced: "text-red-400 border-red-800",
};

export default function ScenariosPage() {
  const { ready } = useRequireAuth();
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [progressBySlug, setProgressBySlug] = useState<Record<string, ProgressEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    Promise.all([listScenarios(), listProgress()])
      .then(([scenarioRes, progressRes]) => {
        setScenarios(scenarioRes.scenarios);
        const map: Record<string, ProgressEntry> = {};
        for (const p of progressRes.progress) map[p.scenario.slug] = p;
        setProgressBySlug(map);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat skenario"))
      .finally(() => setLoading(false));
  }, [ready]);

  if (!ready) return null;

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <AppHeader />
      <h1 className="mb-6 text-2xl font-semibold">Daftar Skenario</h1>

      {loading && <p className="text-sm text-gray-500">Memuat...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {scenarios.map((s) => {
          const completed = progressBySlug[s.slug]?.status === "completed";
          return (
            <div key={s.id} className="flex flex-col gap-3 rounded-lg border border-gray-800 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-medium">{s.title}</h2>
                <div className="flex shrink-0 gap-1">
                  {completed && (
                    <span className="rounded-full border border-green-800 px-2 py-0.5 text-xs text-green-400">
                      Selesai
                    </span>
                  )}
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${LEVEL_COLOR[s.level] ?? "text-gray-400 border-gray-700"}`}
                  >
                    {s.level}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-400">{s.description}</p>
              <Link
                href={`/dashboard/scenarios/${s.slug}`}
                className="mt-auto self-start rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:border-accent hover:text-accent"
              >
                {completed ? "Lihat Ulang" : "Mulai Misi"}
              </Link>
            </div>
          );
        })}
      </div>
    </main>
  );
}
