"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/api";

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLeaderboard()
      .then((res) => setEntries(res.leaderboard))
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat leaderboard"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Leaderboard</h1>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-accent">
          Ke Dashboard
        </Link>
      </div>

      {loading && <p className="text-sm text-gray-500">Memuat...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!loading && entries.length === 0 && (
        <p className="text-sm text-gray-500">Belum ada skor tercatat. Selesaikan skenario untuk masuk leaderboard.</p>
      )}

      <div className="flex max-w-lg flex-col gap-2">
        {entries.map((entry, i) => (
          <div key={entry.username} className="flex items-center gap-3 rounded-lg border border-gray-800 p-3">
            <span className="w-6 text-center text-sm font-medium text-gray-500">{i + 1}</span>
            <span className="flex-1 text-sm text-gray-200">{entry.username}</span>
            <span className="text-sm font-medium text-accent">{entry.totalScore} pts</span>
          </div>
        ))}
      </div>
    </main>
  );
}
