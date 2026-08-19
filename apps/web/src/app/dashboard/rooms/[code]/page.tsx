"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getRoomState, joinRoom, type RoomState } from "@/lib/api";
import { useRoomSocket } from "@/hooks/useRoomSocket";
import { useRequireAuth } from "@/hooks/useAuth";
import AppHeader from "@/components/layout/AppHeader";

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = params.code.toUpperCase();
  const { ready, user } = useRequireAuth();
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { connected, error: socketError, claim, complete } = useRoomSocket(code, setState);

  useEffect(() => {
    if (!ready) return;
    joinRoom(code)
      .catch(() => {})
      .finally(() => {
        getRoomState(code)
          .then((res) => setState(res.state))
          .catch((err) => setError(err instanceof Error ? err.message : "Room tidak ditemukan"));
      });
  }, [ready, code]);

  const copyCode = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!ready) return null;
  if (error)
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <AppHeader />
        <p className="text-sm text-red-400">{error}</p>
      </main>
    );
  if (!state)
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <AppHeader />
        <p className="text-sm text-gray-500">Memuat room...</p>
      </main>
    );

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <AppHeader />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{state.scenario.title}</h1>
          <p className="text-sm text-gray-500">Room multiplayer, kerjakan objective bareng-bareng.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${connected ? "text-green-400" : "text-red-400"}`}>
            {connected ? "● live" : "● terputus"}
          </span>
          <button
            onClick={copyCode}
            className="rounded-md border border-gray-700 px-3 py-1.5 text-sm tracking-widest text-gray-200 hover:border-accent hover:text-accent"
          >
            {copied ? "Tersalin!" : `Kode: ${code}`}
          </button>
        </div>
      </div>

      {socketError && <p className="mb-3 text-sm text-red-400">{socketError}</p>}

      {state.status === "completed" && (
        <div className="mb-6 rounded-lg border border-green-800 bg-green-950/20 p-4 text-center">
          <div className="mb-1 text-2xl">✓</div>
          <p className="text-green-400">Room selesai! Semua objective sudah diselesaikan bersama.</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <section className="rounded-lg border border-gray-800 p-4">
          <h2 className="mb-3 text-sm uppercase tracking-wide text-gray-500">Objectives</h2>
          <div className="flex flex-col gap-2">
            {state.scenario.objectives.map((o) => {
              const claimedBy = state.claims[o.id];
              const claimedByMe = claimedBy === user?.id;
              const done = state.completedObjectives[o.id];
              const claimedByUsername = state.members.find((m) => m.userId === claimedBy)?.username;

              return (
                <div
                  key={o.id}
                  className={`flex items-center justify-between rounded-lg border p-3 text-sm ${
                    done ? "border-green-800 bg-green-950/10" : "border-gray-800"
                  }`}
                >
                  <div>
                    <div className={done ? "text-gray-500 line-through" : "text-gray-200"}>{o.description}</div>
                    <div className="text-xs text-gray-500">
                      {done
                        ? `Selesai oleh ${claimedByUsername ?? "?"}`
                        : claimedBy
                          ? `Diklaim oleh ${claimedByUsername ?? "?"}`
                          : "Belum diklaim"}
                      {" · "}
                      {o.points} pts
                    </div>
                  </div>
                  {!done && (
                    <div className="flex gap-1">
                      {!claimedBy && (
                        <button
                          onClick={() => claim(o.id)}
                          className="rounded-md border border-gray-700 px-2 py-1 text-xs hover:border-accent hover:text-accent"
                        >
                          Klaim
                        </button>
                      )}
                      {claimedByMe && (
                        <>
                          <button
                            onClick={() => claim(o.id)}
                            className="rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
                          >
                            Batal
                          </button>
                          <button
                            onClick={() => complete(o.id)}
                            className="rounded-md border border-green-700 px-2 py-1 text-xs text-green-400 hover:bg-green-950/40"
                          >
                            Selesai
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="rounded-lg border border-gray-800 p-4">
          <h2 className="mb-3 text-sm uppercase tracking-wide text-gray-500">Pemain ({state.members.length})</h2>
          <div className="flex flex-col gap-2">
            {state.members.map((m) => (
              <div key={m.userId} className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                {m.username}
                {m.userId === state.hostId && <span className="text-xs text-yellow-400">(host)</span>}
                {m.userId === user?.id && <span className="text-xs text-accent">(Anda)</span>}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
