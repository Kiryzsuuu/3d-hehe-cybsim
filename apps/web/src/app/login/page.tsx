"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token } = await login(email, password);
      localStorage.setItem("cybersim_token", token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg border border-gray-800 p-6">
        <h1 className="text-xl font-semibold">Masuk</h1>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-md border border-gray-700 bg-transparent px-3 py-2 text-sm"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full rounded-md border border-gray-700 bg-transparent px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent py-2 font-medium text-black disabled:opacity-50"
        >
          {loading ? "Memproses..." : "Login"}
        </button>
        <p className="text-center text-sm text-gray-500">
          Belum punya akun?{" "}
          <a href="/register" className="text-accent">
            Daftar
          </a>
        </p>
      </form>
    </main>
  );
}
