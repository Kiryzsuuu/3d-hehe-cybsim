"use client";

import Link from "next/link";
import { useRequireAuth } from "@/hooks/useAuth";
import AppHeader from "@/components/layout/AppHeader";

interface Step {
  title: string;
  body: string;
  cta?: { href: string; label: string };
}

const STEPS: Step[] = [
  {
    title: "1. Terminal",
    body: "Terminal di Dashboard adalah CLI simulasi. Ketik `help` untuk melihat daftar perintah yang tersedia (ping, whoami, ifconfig, show, dll). Setiap perintah divalidasi server-side lewat whitelist, jadi aman untuk dicoba-coba.",
    cta: { href: "/dashboard", label: "Buka Dashboard" },
  },
  {
    title: "2. Skenario & Misi",
    body: "Buka halaman Skenario untuk melihat daftar misi. Klik salah satu untuk mulai: centang objective yang sudah Anda selesaikan, buka hint kalau butuh petunjuk, lalu klik 'Tandai Selesai' setelah semua objective tercentang. Beberapa misi punya flag CTF tersembunyi yang harus di-decode dan disubmit untuk poin bonus.",
    cta: { href: "/dashboard/scenarios", label: "Lihat Skenario" },
  },
  {
    title: "3. Network Topology",
    body: "Susun perangkat jaringan (router, switch, PC, server, firewall) dengan drag-and-drop, sambungkan dengan menarik garis antar node. Gunakan 'Cek Konektivitas' untuk menguji apakah dua perangkat bisa saling terhubung — hasilnya dihitung oleh engine simulasi jaringan sungguhan dan jalurnya akan tersorot di editor, plus muncul dalam bentuk 3D di panel Server Rack.",
    cta: { href: "/dashboard/network", label: "Buka Network Topology" },
  },
  {
    title: "4. Sandbox & DVWA",
    body: "Di Dashboard, klik 'Mulai Sandbox' untuk menyalakan container Docker terisolasi khusus Anda. Klik 'Mulai DVWA' untuk menyalakan target latihan hacking sungguhan (SQL Injection, XSS, CSRF) di container terpisah. Selalu klik 'Hentikan' setelah selesai supaya resource tidak terbuang.",
    cta: { href: "/dashboard", label: "Buka Dashboard" },
  },
  {
    title: "5. Room Multiplayer",
    body: "Selain main solo, Anda bisa buat Room untuk mengerjakan skenario bareng teman: satu orang jadi host dan bagikan kode room, yang lain join pakai kode itu. Objective bisa 'diklaim' per pemain supaya kerjaan terbagi, dan progres semua pemain tersinkron real-time.",
    cta: { href: "/dashboard/rooms", label: "Buka Room" },
  },
  {
    title: "6. Chat",
    body: "World Chat untuk ngobrol dengan semua pemain, DM untuk chat pribadi (cari lewat username), atau buat Grup dan undang pemain lain lewat username mereka. Semua real-time lewat WebSocket.",
    cta: { href: "/dashboard/chat", label: "Buka Chat" },
  },
  {
    title: "7. Leaderboard & Profil",
    body: "Leaderboard menampilkan total skor semua pemain, terurut dari tertinggi. Profil menampilkan statistik Anda sendiri (skor total, misi selesai, flag ditangkap, peringkat) dan riwayat/checkpoint setiap skenario yang pernah Anda kerjakan.",
    cta: { href: "/dashboard/profile", label: "Lihat Profil" },
  },
];

export default function TutorialPage() {
  const { ready } = useRequireAuth();
  if (!ready) return null;

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <AppHeader />
      <h1 className="mb-2 text-2xl font-semibold">Tutorial</h1>
      <p className="mb-6 text-sm text-gray-500">Panduan singkat semua fitur CyberSim.</p>

      <div className="flex max-w-2xl flex-col gap-4">
        {STEPS.map((step) => (
          <div key={step.title} className="rounded-lg border border-gray-800 p-4">
            <h2 className="mb-1 font-medium text-accent">{step.title}</h2>
            <p className="mb-3 text-sm text-gray-400">{step.body}</p>
            {step.cta && (
              <Link
                href={step.cta.href}
                className="inline-block rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:border-accent hover:text-accent"
              >
                {step.cta.label}
              </Link>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
