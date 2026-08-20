import type { ProfileStats } from "../scenario/scenario.service.js";

export interface AchievementDef {
  id: string;
  label: string;
  description: string;
  icon: string;
  target: number;
  metric: keyof Pick<ProfileStats, "totalScore" | "scenariosCompleted" | "flagsCaptured"> | "rank";
}

// Fixed, hand-authored definitions rather than a database table: every
// condition here is derivable from the same ProfileStats already computed
// for the profile page, so unlocked/locked state is just evaluated fresh on
// each request instead of needing a UserAchievement table to keep in sync.
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first-steps",
    label: "Langkah Pertama",
    description: "Selesaikan skenario pertamamu",
    icon: "🎯",
    target: 1,
    metric: "scenariosCompleted",
  },
  {
    id: "scenario-veteran",
    label: "Veteran Skenario",
    description: "Selesaikan 5 skenario",
    icon: "🧠",
    target: 5,
    metric: "scenariosCompleted",
  },
  {
    id: "flag-hunter",
    label: "Pemburu Bendera",
    description: "Tangkap 3 flag CTF",
    icon: "🚩",
    target: 3,
    metric: "flagsCaptured",
  },
  {
    id: "flag-master",
    label: "Master Flag",
    description: "Tangkap 10 flag CTF",
    icon: "🏴",
    target: 10,
    metric: "flagsCaptured",
  },
  {
    id: "score-100",
    label: "Skor 100",
    description: "Kumpulkan total skor 100 poin",
    icon: "⭐",
    target: 100,
    metric: "totalScore",
  },
  {
    id: "score-500",
    label: "Skor 500",
    description: "Kumpulkan total skor 500 poin",
    icon: "🌟",
    target: 500,
    metric: "totalScore",
  },
  {
    id: "top-3",
    label: "Papan Atas",
    description: "Masuk 3 besar leaderboard",
    icon: "🏆",
    target: 3,
    metric: "rank",
  },
  {
    id: "rank-1",
    label: "Sang Juara",
    description: "Jadi peringkat #1 leaderboard",
    icon: "👑",
    target: 1,
    metric: "rank",
  },
];

export interface AchievementResult extends AchievementDef {
  unlocked: boolean;
  progress: number;
}

function metricValue(stats: ProfileStats, metric: AchievementDef["metric"]): number | null {
  if (metric === "rank") return stats.rank;
  return stats[metric];
}

export function evaluateAchievements(stats: ProfileStats): AchievementResult[] {
  return ACHIEVEMENTS.map((def) => {
    const value = metricValue(stats, def.metric);
    if (value === null) {
      return { ...def, unlocked: false, progress: 0 };
    }
    // Rank counts down to the goal (lower is better) and has no meaningful
    // continuous "progress" (there's no fixed max rank), so it's simply
    // unlocked or not. Every other metric counts up toward target and
    // clamps there for a 0..target progress bar.
    if (def.metric === "rank") {
      const unlocked = value <= def.target;
      return { ...def, unlocked, progress: unlocked ? def.target : 0 };
    }
    const unlocked = value >= def.target;
    return { ...def, unlocked, progress: Math.min(value, def.target) };
  });
}
