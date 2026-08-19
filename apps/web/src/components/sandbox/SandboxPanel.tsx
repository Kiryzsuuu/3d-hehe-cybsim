"use client";

import { useEffect, useState } from "react";
import { getSandboxStatus, startSandbox, stopSandbox, type SandboxStatus } from "@/lib/api";

export default function SandboxPanel() {
  const [status, setStatus] = useState<SandboxStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => getSandboxStatus().then(setStatus).catch((err) => setError(err.message));

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const onStart = async () => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await startSandbox());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memulai sandbox");
    } finally {
      setBusy(false);
    }
  };

  const onStop = async () => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await stopSandbox());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghentikan sandbox");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-800 p-4">
      {loading && <p className="text-sm text-gray-500">Memuat status sandbox...</p>}
      {!loading && (
        <>
          <div className="mb-3 flex items-center gap-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${status?.running ? "bg-green-500" : "bg-gray-600"}`} />
            {status?.running ? "Sandbox aktif" : "Sandbox tidak aktif"}
          </div>
          <p className="mb-3 text-xs text-gray-500">
            Container Docker terisolasi khusus untuk Anda (tanpa akses jaringan host, CPU/RAM dibatasi).
          </p>
          <div className="flex gap-2">
            <button
              onClick={onStart}
              disabled={busy || !!status?.running}
              className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:border-accent hover:text-accent disabled:opacity-40"
            >
              {busy ? "Memproses..." : "Mulai Sandbox"}
            </button>
            <button
              onClick={onStop}
              disabled={busy || !status?.running}
              className="rounded-md border border-red-800 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950 disabled:opacity-40"
            >
              Hentikan
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </>
      )}
    </div>
  );
}
