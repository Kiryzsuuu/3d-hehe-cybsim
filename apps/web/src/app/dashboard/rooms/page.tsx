"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listScenarios, createRoom, joinRoom, type ScenarioSummary } from "@/lib/api";
import { useRequireAuth } from "@/hooks/useAuth";
import AppHeader from "@/components/layout/AppHeader";

export default function RoomsLobbyPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    listScenarios().then((res) => {
      setScenarios(res.scenarios);
      if (res.scenarios[0]) setSelectedSlug(res.scenarios[0].slug);
    });
  }, [ready]);

  const onCreate = async () => {
    if (!selectedSlug) return;
    setBusy(true);
    setError(null);
    try {
      const { code } = await createRoom(selectedSlug);
      router.push(`/dashboard/rooms/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat room");
      setBusy(false);
    }
  };

  const onJoin = async () => {
    if (!joinCode.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await joinRoom(joinCode.trim().toUpperCase());
      router.push(`/dashboard/rooms/${joinCode.trim().toUpperCase()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Room tidak ditemukan");
      setBusy(false);
    }
  };

  if (!ready) return null;

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <AppHeader />
      <h1 className="mb-2 text-2xl font-semibold">Room Multiplayer</h1>
      <p className="mb-6 text-sm text-gray-500">
        Kerjakan skenario bareng teman: buat room dan bagikan kodenya, atau join pakai kode yang sudah ada. Objective
        bisa diklaim per pemain supaya kerjaan terbagi.
      </p>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-800 p-4">
          <h2 className="mb-3 text-sm uppercase tracking-wide text-gray-500">Buat Room</h2>
          <select
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
            className="mb-3 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200"
          >
            {scenarios.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.title}
              </option>
            ))}
          </select>
          <button
            onClick={onCreate}
            disabled={busy || !selectedSlug}
            className="w-full rounded-md bg-accent py-2 text-sm font-medium text-black disabled:opacity-40"
          >
            Buat Room
          </button>
        </div>

        <div className="rounded-lg border border-gray-800 p-4">
          <h2 className="mb-3 text-sm uppercase tracking-wide text-gray-500">Join Room</h2>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Kode room (mis. AB3XY9)"
            maxLength={6}
            className="mb-3 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm uppercase tracking-widest text-gray-200"
          />
          <button
            onClick={onJoin}
            disabled={busy || !joinCode.trim()}
            className="w-full rounded-md border border-gray-700 py-2 text-sm text-gray-300 hover:border-accent hover:text-accent disabled:opacity-40"
          >
            Join Room
          </button>
        </div>
      </div>
    </main>
  );
}
