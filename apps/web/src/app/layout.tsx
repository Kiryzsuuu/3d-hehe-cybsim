import type { Metadata } from "next";
import "./globals.css";
import AchievementToastHost from "@/components/AchievementToast";

export const metadata: Metadata = {
  title: "CyberSim — Network & Cyber Security Simulator",
  description: "Interactive network topology, terminal CLI, and CTF-style cybersecurity training.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <AchievementToastHost />
      </body>
    </html>
  );
}
