import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight">
        🛡️ Cyber<span className="text-accent">Sim</span>
      </h1>
      <p className="max-w-xl text-gray-400">
        Network & Cyber Security Simulator — jelajahi topologi jaringan interaktif, kuasai terminal CLI,
        dan selesaikan misi CTF berjenjang.
      </p>
      <div className="flex gap-4">
        <Link
          href="/dashboard"
          className="rounded-md bg-accent px-5 py-2 font-medium text-black hover:opacity-90"
        >
          Masuk Dashboard
        </Link>
      </div>
    </main>
  );
}
