"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRequireAuth } from "@/hooks/useAuth";
import { markTutorialComplete } from "@/lib/api";
import AppHeader from "@/components/layout/AppHeader";

interface Step {
  title: string;
  body: string;
  cta?: { href: string; label: string };
}

const STEPS: Step[] = [
  {
    title: "World",
    body: "Buka World untuk jalan-jalan di peta 3D dengan karakter Anda (WASD atau panah untuk bergerak). Dekati salah satu 'stasiun' di peta dan tekan E untuk masuk ke fiturnya — cara alternatif untuk berpindah menu selain lewat navbar di atas. Tekan T untuk chat, dan 1-4 untuk emote ke pemain lain yang online bareng Anda.",
    cta: { href: "/world", label: "Buka World" },
  },
  {
    title: "Terminal",
    body: "Terminal di Dashboard adalah CLI simulasi. Ketik `help` untuk melihat daftar perintah yang tersedia (ping, whoami, ifconfig, show, dll). Setiap perintah divalidasi server-side lewat whitelist, jadi aman untuk dicoba-coba.",
    cta: { href: "/dashboard", label: "Buka Dashboard" },
  },
  {
    title: "Skenario & Misi",
    body: "Buka halaman Skenario untuk melihat daftar misi. Klik salah satu untuk mulai: centang objective yang sudah Anda selesaikan, buka hint kalau butuh petunjuk, lalu klik 'Tandai Selesai' setelah semua objective tercentang. Beberapa misi punya flag CTF tersembunyi yang harus di-decode dan disubmit untuk poin bonus.",
    cta: { href: "/dashboard/scenarios", label: "Lihat Skenario" },
  },
  {
    title: "Network Topology",
    body: "Susun perangkat jaringan (router, switch, PC, server, firewall) dengan drag-and-drop, sambungkan dengan menarik garis antar node. Gunakan 'Cek Konektivitas' untuk menguji apakah dua perangkat bisa saling terhubung — hasilnya dihitung oleh engine simulasi jaringan sungguhan dan jalurnya akan tersorot di editor, plus muncul dalam bentuk 3D di panel Server Rack.",
    cta: { href: "/dashboard/network", label: "Buka Network Topology" },
  },
  {
    title: "Sandbox & DVWA",
    body: "Di Dashboard, klik 'Mulai Sandbox' untuk menyalakan container Docker terisolasi khusus Anda. Klik 'Mulai DVWA' untuk menyalakan target latihan hacking sungguhan (SQL Injection, XSS, CSRF) di container terpisah. Selalu klik 'Hentikan' setelah selesai supaya resource tidak terbuang.",
    cta: { href: "/dashboard", label: "Buka Dashboard" },
  },
  {
    title: "Room Multiplayer",
    body: "Selain main solo, Anda bisa buat Room untuk mengerjakan skenario bareng teman: satu orang jadi host dan bagikan kode room, yang lain join pakai kode itu. Objective bisa 'diklaim' per pemain supaya kerjaan terbagi, dan progres semua pemain tersinkron real-time.",
    cta: { href: "/dashboard/rooms", label: "Buka Room" },
  },
  {
    title: "Chat",
    body: "World Chat untuk ngobrol dengan semua pemain, DM untuk chat pribadi (cari lewat username), atau buat Grup dan undang pemain lain lewat username mereka. Semua real-time lewat WebSocket.",
    cta: { href: "/dashboard/chat", label: "Buka Chat" },
  },
  {
    title: "Leaderboard, Profil & Pencapaian",
    body: "Leaderboard menampilkan total skor semua pemain, terurut dari tertinggi. Profil menampilkan statistik Anda sendiri (skor total, misi selesai, flag ditangkap, peringkat), badge pencapaian yang sudah/belum terbuka, dan riwayat/checkpoint setiap skenario yang pernah Anda kerjakan.",
    cta: { href: "/dashboard/profile", label: "Lihat Profil" },
  },
];

export default function TutorialPage() {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);

  if (!ready) return null;

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const finish = async () => {
    setFinishing(true);
    try {
      await markTutorialComplete();
    } catch {
      // best-effort: don't trap the user in the tutorial if this call fails
    }
    router.push("/world");
  };

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <AppHeader />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tutorial</h1>
          <p className="text-sm text-gray-500">
            Langkah {stepIndex + 1} dari {STEPS.length}
          </p>
        </div>
        <button onClick={finish} disabled={finishing} className="text-sm text-gray-500 hover:text-accent">
          Lewati tutorial →
        </button>
      </div>

      <div className="mb-6 flex max-w-2xl gap-1.5">
        {STEPS.map((s, i) => (
          <button
            key={s.title}
            onClick={() => setStepIndex(i)}
            aria-label={`Langkah ${i + 1}: ${s.title}`}
            className={`h-1.5 flex-1 rounded-full transition ${i <= stepIndex ? "bg-accent" : "bg-gray-800"}`}
          />
        ))}
      </div>

      <div className="max-w-2xl rounded-lg border border-gray-800 p-6">
        <h2 className="mb-2 text-lg font-medium text-accent">{step.title}</h2>
        <p className="mb-4 text-sm text-gray-400">{step.body}</p>
        {step.cta && (
          <Link
            href={step.cta.href}
            target="_blank"
            className="inline-block rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:border-accent hover:text-accent"
          >
            {step.cta.label} (tab baru) ↗
          </Link>
        )}
      </div>

      <div className="mt-6 flex max-w-2xl justify-between">
        <button
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          disabled={stepIndex === 0}
          className="rounded-md border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-accent hover:text-accent disabled:opacity-30"
        >
          ← Kembali
        </button>
        {isLast ? (
          <button
            onClick={finish}
            disabled={finishing}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {finishing ? "Menyimpan..." : "Selesai, mulai main →"}
          </button>
        ) : (
          <button
            onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black"
          >
            Selanjutnya →
          </button>
        )}
      </div>
    </main>
  );
}
