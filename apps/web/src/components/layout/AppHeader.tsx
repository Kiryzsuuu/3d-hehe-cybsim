"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, useRequireAuth } from "@/hooks/useAuth";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/scenarios", label: "Skenario" },
  { href: "/dashboard/network", label: "Network Topology" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useRequireAuth();

  const onLogout = () => {
    clearSession();
    router.push("/login");
  };

  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-4">
      <nav className="flex flex-wrap gap-1">
        {NAV_LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-1.5 text-sm ${
                active ? "border border-accent text-accent" : "border border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-3 text-sm text-gray-400">
        {user && <span>{user.username}</span>}
        <button onClick={onLogout} className="rounded-md border border-gray-700 px-3 py-1.5 hover:border-red-800 hover:text-red-400">
          Logout
        </button>
      </div>
    </header>
  );
}
