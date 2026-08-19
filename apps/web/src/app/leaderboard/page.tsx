"use client";

import { useEffect, useState } from "react";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/api";
import { useRequireAuth } from "@/hooks/useAuth";
import AppHeader from "@/components/layout/AppHeader";

const MEDAL = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const { ready, user } = useRequireAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    getLeaderboard()
      .then((res) => setEntries(res.leaderboard))
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat leaderboard"))
      .finally(() => setLoading(false));
  }, [ready]);

  if (!ready) return null;

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <AppHeader />
      <h1 className="mb-6 text-2xl font-semibold">Leaderboard</h1>

      {loading && <p className="text-sm text-gray-500">Memuat...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!loading && entries.length === 0 && (
        <p className="text-sm text-gray-500">Belum ada skor tercatat. Selesaikan skenario untuk masuk leaderboard.</p>
      )}

      <div className="flex max-w-lg flex-col gap-2">
        {entries.map((entry, i) => {
          const isMe = entry.username === user?.username;
          return (
            <div
              key={entry.username}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                isMe ? "border-accent bg-cyan-950/20" : "border-gray-800"
              }`}
            >
              <span className="w-6 text-center text-sm font-medium text-gray-500">{MEDAL[i] ?? i + 1}</span>
              <span className="flex-1 text-sm text-gray-200">
                {entry.username}
                {isMe && <span className="ml-2 text-xs text-accent">(Anda)</span>}
              </span>
              <span className="text-sm font-medium text-accent">{entry.totalScore} pts</span>
            </div>
          );
        })}
      </div>
    </main>
  );
}
