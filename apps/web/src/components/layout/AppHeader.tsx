"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, useRequireAuth } from "@/hooks/useAuth";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/scenarios", label: "Skenario" },
  { href: "/dashboard/rooms", label: "Room" },
  { href: "/dashboard/network", label: "Network Topology" },
  { href: "/dashboard/chat", label: "Chat" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/dashboard/profile", label: "Profil" },
  { href: "/tutorial", label: "Tutorial" },
];

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useRequireAuth();

  const onLogout = () => {
    clearSession();
    router.push("/login");
  };

  const links = user?.role === "admin" ? [...NAV_LINKS, { href: "/dashboard/admin", label: "Admin" }] : NAV_LINKS;

  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-4">
      <nav className="flex flex-wrap gap-1">
        {links.map((link) => {
          const active = link.href === "/dashboard" ? pathname === "/dashboard" : pathname?.startsWith(link.href);
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
        {user && (
          <span>
            {user.username}
            {user.role === "admin" && <span className="ml-1 text-xs text-yellow-400">(admin)</span>}
          </span>
        )}
        <button onClick={onLogout} className="rounded-md border border-gray-700 px-3 py-1.5 hover:border-red-800 hover:text-red-400">
          Logout
        </button>
      </div>
    </header>
  );
}
