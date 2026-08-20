"use client";

import { useEffect, useState } from "react";
import { getProfile, getAvatarColors, setAvatarColor, type ProfileResponse } from "@/lib/api";
import { useRequireAuth } from "@/hooks/useAuth";
import AppHeader from "@/components/layout/AppHeader";

const STATUS_LABEL: Record<string, string> = {
  in_progress: "Sedang berjalan",
  completed: "Selesai",
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-800 p-4 text-center">
      <div className="text-2xl font-semibold text-accent">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

export default function ProfilePage() {
  const { ready } = useRequireAuth();
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [colors, setColors] = useState<string[]>([]);
  const [savingColor, setSavingColor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    Promise.all([getProfile(), getAvatarColors()])
      .then(([profile, avatars]) => {
        setData(profile);
        setColors(avatars.colors);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat profil"))
      .finally(() => setLoading(false));
  }, [ready]);

  const pickColor = async (color: string) => {
    if (!data || savingColor) return;
    setSavingColor(true);
    try {
      await setAvatarColor(color);
      setData({ ...data, user: { ...data.user, avatarColor: color } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan warna avatar");
    } finally {
      setSavingColor(false);
    }
  };

  if (!ready) return null;

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <AppHeader />
      <h1 className="mb-6 text-2xl font-semibold">Profil</h1>

      {loading && <p className="text-sm text-gray-500">Memuat...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {data && (
        <>
          <div className="mb-6 flex items-center gap-4 rounded-lg border border-gray-800 p-4">
            <div
              className="h-14 w-14 shrink-0 rounded-full border-2 border-gray-700"
              style={{ backgroundColor: data.user.avatarColor }}
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-medium">{data.user.username}</div>
                  <div className="text-sm text-gray-500">{data.user.email}</div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  {data.user.role === "admin" && <div className="mb-1 text-yellow-400">Admin</div>}
                  Bergabung sejak {new Date(data.user.createdAt).toLocaleDateString("id-ID")}
                </div>
              </div>
            </div>
          </div>

          <h2 className="mb-3 text-sm uppercase tracking-wide text-gray-500">Warna Avatar</h2>
          <p className="mb-2 text-xs text-gray-500">
            Warna karakter Anda di World dan Room Multiplayer, terlihat oleh pemain lain secara real-time.
          </p>
          <div className="mb-6 flex flex-wrap gap-2">
            {colors.map((color) => (
              <button
                key={color}
                onClick={() => pickColor(color)}
                disabled={savingColor}
                className={`h-9 w-9 rounded-full border-2 transition ${
                  data.user.avatarColor === color ? "border-white scale-110" : "border-transparent hover:border-gray-500"
                }`}
                style={{ backgroundColor: color }}
                aria-label={color}
              />
            ))}
          </div>

          <h2 className="mb-3 text-sm uppercase tracking-wide text-gray-500">Statistik</h2>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Total Skor" value={data.stats.totalScore} />
            <StatCard label="Misi Selesai" value={data.stats.scenariosCompleted} />
            <StatCard label="Sedang Berjalan" value={data.stats.scenariosInProgress} />
            <StatCard label="Flag Ditangkap" value={data.stats.flagsCaptured} />
            <StatCard label="Peringkat" value={data.stats.rank ? `#${data.stats.rank}` : "-"} />
          </div>

          <h2 className="mb-3 text-sm uppercase tracking-wide text-gray-500">Riwayat / Checkpoint</h2>
          {data.history.length === 0 && (
            <p className="text-sm text-gray-500">Belum ada riwayat. Mulai skenario pertama Anda.</p>
          )}
          <div className="flex flex-col gap-2">
            {data.history.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border border-gray-800 p-3 text-sm">
                <div>
                  <div className="font-medium">{h.scenario.title}</div>
                  <div className="text-xs text-gray-500">
                    {STATUS_LABEL[h.status] ?? h.status}
                    {h.completedAt && ` · Selesai ${new Date(h.completedAt).toLocaleString("id-ID")}`}
                    {!h.completedAt && ` · Diperbarui ${new Date(h.updatedAt).toLocaleString("id-ID")}`}
                  </div>
                </div>
                <div className="text-accent">{h.score} pts</div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
