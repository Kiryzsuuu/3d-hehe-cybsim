"use client";

import { useEffect, useState } from "react";
import { getDvwaStatus, startDvwa, stopDvwa, type DvwaStatus } from "@/lib/api";

export default function DvwaPanel() {
  const [status, setStatus] = useState<DvwaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDvwaStatus()
      .then(setStatus)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const onStart = async () => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await startDvwa());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memulai DVWA");
    } finally {
      setBusy(false);
    }
  };

  const onStop = async () => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await stopDvwa());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghentikan DVWA");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-800 p-4">
      {loading && <p className="text-sm text-gray-500">Memuat status DVWA...</p>}
      {!loading && (
        <>
          <div className="mb-3 flex items-center gap-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${status?.running ? "bg-green-500" : "bg-gray-600"}`} />
            {status?.running ? "DVWA target aktif" : "DVWA target tidak aktif"}
          </div>
          <p className="mb-3 text-xs text-gray-500">
            Damn Vulnerable Web App di dalam container terisolasi khusus untuk Anda: jaringan privat sendiri
            (tidak dibagikan ke user lain), hanya bisa diakses dari komputer Anda sendiri, dan
            CPU/RAM dibatasi. Latihan SQL Injection, XSS, dan CSRF.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onStart}
              disabled={busy || !!status?.running}
              className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:border-accent hover:text-accent disabled:opacity-40"
            >
              {busy ? "Memproses..." : "Mulai DVWA"}
            </button>
            <button
              onClick={onStop}
              disabled={busy || !status?.running}
              className="rounded-md border border-red-800 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950 disabled:opacity-40"
            >
              Hentikan
            </button>
            {status?.running && status.url && (
              <a
                href={status.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent hover:text-black"
              >
                Buka DVWA →
              </a>
            )}
          </div>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </>
      )}
    </div>
  );
}
