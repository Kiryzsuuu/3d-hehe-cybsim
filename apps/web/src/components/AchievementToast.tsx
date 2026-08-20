"use client";

import { useEffect, useState } from "react";
import type { Achievement } from "@/lib/api";

const EVENT_NAME = "cybersim:achievement-unlocked";

// Fired by any page/component after a completeScenario or submitFlag call
// returns newlyUnlocked achievements, rather than threading a callback prop
// through every scenario/room component — this notification is genuinely
// global (can fire from a top-down hub page or a first-person room) and a
// DOM CustomEvent is the simplest way to reach a toast mounted once in the
// root layout without a dedicated context provider.
export function announceUnlocked(achievements: Achievement[]) {
  if (achievements.length === 0) return;
  window.dispatchEvent(new CustomEvent<Achievement[]>(EVENT_NAME, { detail: achievements }));
}

interface QueuedToast extends Achievement {
  toastId: number;
}

let toastIdCounter = 0;

export default function AchievementToastHost() {
  const [queue, setQueue] = useState<QueuedToast[]>([]);

  useEffect(() => {
    const onUnlock = (e: Event) => {
      const achievements = (e as CustomEvent<Achievement[]>).detail;
      const withIds = achievements.map((a) => ({ ...a, toastId: ++toastIdCounter }));
      setQueue((prev) => [...prev, ...withIds]);
      for (const t of withIds) {
        setTimeout(() => {
          setQueue((prev) => prev.filter((q) => q.toastId !== t.toastId));
        }, 5000);
      }
    };
    window.addEventListener(EVENT_NAME, onUnlock);
    return () => window.removeEventListener(EVENT_NAME, onUnlock);
  }, []);

  if (queue.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[100] flex flex-col gap-2">
      {queue.map((t) => (
        <div
          key={t.toastId}
          className="animate-[slide-in_0.3s_ease-out] flex items-center gap-3 rounded-lg border border-accent bg-gray-950/95 px-4 py-3 shadow-lg"
        >
          <div className="text-3xl">{t.icon}</div>
          <div>
            <div className="text-xs uppercase tracking-wide text-accent">Pencapaian Terbuka!</div>
            <div className="text-sm font-medium text-gray-100">{t.label}</div>
            <div className="text-xs text-gray-400">{t.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
