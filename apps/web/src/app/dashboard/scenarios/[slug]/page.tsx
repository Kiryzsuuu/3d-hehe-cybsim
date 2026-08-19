"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getScenario, startScenario, completeScenario, type ScenarioDetail } from "@/lib/api";

export default function ScenarioDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [scenario, setScenario] = useState<ScenarioDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [hintsShown, setHintsShown] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getScenario(params.slug)
      .then((res) => setScenario(res.scenario))
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat skenario"))
      .finally(() => setLoading(false));
    startScenario(params.slug).catch(() => {
      // best-effort: viewing a scenario shouldn't fail if this call errors
    });
  }, [params.slug]);

  const toggleObjective = (id: string) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const allDone = scenario ? scenario.data.objectives.every((o) => checked[o.id]) : false;
  const totalScore = scenario
    ? scenario.data.objectives.reduce((sum, o) => (checked[o.id] ? sum + o.points : sum), 0)
    : 0;

  const onComplete = async () => {
    if (!scenario) return;
    setSubmitting(true);
    try {
      await completeScenario(scenario.slug, totalScore);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyelesaikan skenario");
      setSubmitting(false);
    }
  };

  if (loading) return <main className="min-h-screen px-4 py-8 md:px-8 text-sm text-gray-500">Memuat...</main>;
  if (error || !scenario)
    return <main className="min-h-screen px-4 py-8 md:px-8 text-sm text-red-400">{error ?? "Skenario tidak ditemukan"}</main>;

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <Link href="/dashboard/scenarios" className="text-sm text-gray-500 hover:text-accent">
        ← Kembali ke daftar skenario
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold">{scenario.title}</h1>
        <p className="mt-1 text-sm text-gray-400">{scenario.description}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-800 p-4">
          <h2 className="mb-3 text-sm uppercase tracking-wide text-gray-500">Objectives</h2>
          <ul className="flex flex-col gap-2">
            {scenario.data.objectives.map((o) => (
              <li key={o.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!checked[o.id]}
                  onChange={() => toggleObjective(o.id)}
                  className="accent-cyan-400"
                />
                <span className={checked[o.id] ? "text-gray-500 line-through" : "text-gray-200"}>
                  {o.description}
                </span>
                <span className="ml-auto text-xs text-accent">{o.points} pts</span>
              </li>
            ))}
          </ul>

          <button
            onClick={onComplete}
            disabled={!allDone || submitting}
            className="mt-4 w-full rounded-md border border-gray-700 py-2 text-sm text-gray-300 hover:border-accent hover:text-accent disabled:opacity-40"
          >
            {submitting ? "Menyimpan..." : `Tandai Selesai (${totalScore} pts)`}
          </button>
        </section>

        <section className="rounded-lg border border-gray-800 p-4">
          <h2 className="mb-3 text-sm uppercase tracking-wide text-gray-500">Hints</h2>
          {scenario.data.hints.length === 0 && (
            <p className="text-sm text-gray-500">Tidak ada hint untuk skenario ini.</p>
          )}
          <ul className="flex flex-col gap-2">
            {scenario.data.hints.slice(0, hintsShown).map((hint, i) => (
              <li key={i} className="rounded-md bg-gray-900 p-2 text-sm text-gray-300">
                {hint}
              </li>
            ))}
          </ul>
          {hintsShown < scenario.data.hints.length && (
            <button
              onClick={() => setHintsShown((n) => n + 1)}
              className="mt-2 rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:border-accent hover:text-accent"
            >
              Tampilkan hint berikutnya ({hintsShown}/{scenario.data.hints.length})
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
