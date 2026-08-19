"use client";

import { useEffect, useState } from "react";
import { getAdminUsers, getAdminStats, setUserRole, type AdminUserRow, type PlatformStats } from "@/lib/api";
import { useRequireAdmin } from "@/hooks/useAuth";
import AppHeader from "@/components/layout/AppHeader";

export default function AdminPage() {
  const { ready, user } = useRequireAdmin();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () =>
    Promise.all([getAdminUsers(), getAdminStats()]).then(([u, s]) => {
      setUsers(u.users);
      setStats(s.stats);
    });

  useEffect(() => {
    if (!ready) return;
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat data admin"))
      .finally(() => setLoading(false));
  }, [ready]);

  const toggleRole = async (row: AdminUserRow) => {
    const nextRole = row.role === "admin" ? "user" : "admin";
    setBusyId(row.id);
    setError(null);
    try {
      await setUserRole(row.id, nextRole);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah role");
    } finally {
      setBusyId(null);
    }
  };

  if (!ready) return null;

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <AppHeader />
      <h1 className="mb-6 text-2xl font-semibold">Admin</h1>

      {loading && <p className="text-sm text-gray-500">Memuat...</p>}
      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total User", value: stats.totalUsers },
            { label: "Total Skenario", value: stats.totalScenarios },
            { label: "Total Penyelesaian", value: stats.totalCompletions },
            { label: "Total Pesan Chat", value: stats.totalMessages },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-gray-800 p-4 text-center">
              <div className="text-2xl font-semibold text-accent">{s.value}</div>
              <div className="mt-1 text-xs uppercase tracking-wide text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-sm uppercase tracking-wide text-gray-500">Daftar User</h2>
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-800 text-xs uppercase text-gray-500">
            <tr>
              <th className="p-3">Username</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Skor</th>
              <th className="p-3">Selesai</th>
              <th className="p-3">Bergabung</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-900">
                <td className="p-3">{u.username}</td>
                <td className="p-3 text-gray-400">{u.email}</td>
                <td className="p-3">
                  <span className={u.role === "admin" ? "text-yellow-400" : "text-gray-400"}>{u.role}</span>
                </td>
                <td className="p-3 text-accent">{u.totalScore}</td>
                <td className="p-3">{u.scenariosCompleted}</td>
                <td className="p-3 text-gray-500">{new Date(u.createdAt).toLocaleDateString("id-ID")}</td>
                <td className="p-3">
                  <button
                    onClick={() => toggleRole(u)}
                    disabled={busyId === u.id || u.id === user?.id}
                    className="rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:border-accent hover:text-accent disabled:opacity-30"
                  >
                    {u.role === "admin" ? "Cabut admin" : "Jadikan admin"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
