import { describe, it, expect } from "vitest";
import { evaluateAchievements, diffNewlyUnlocked, ACHIEVEMENTS } from "./achievement.service.js";
import type { ProfileStats } from "../scenario/scenario.service.js";

function stats(overrides: Partial<ProfileStats> = {}): ProfileStats {
  return {
    totalScore: 0,
    scenariosCompleted: 0,
    scenariosInProgress: 0,
    flagsCaptured: 0,
    rank: null,
    ...overrides,
  };
}

describe("evaluateAchievements", () => {
  it("returns every defined achievement, all locked, for a fresh user", () => {
    const results = evaluateAchievements(stats());
    expect(results).toHaveLength(ACHIEVEMENTS.length);
    expect(results.every((a) => !a.unlocked)).toBe(true);
  });

  it("unlocks count-up achievements exactly at their target, not before", () => {
    const justUnder = evaluateAchievements(stats({ scenariosCompleted: 0 }));
    const justAt = evaluateAchievements(stats({ scenariosCompleted: 1 }));
    expect(justUnder.find((a) => a.id === "first-steps")!.unlocked).toBe(false);
    expect(justAt.find((a) => a.id === "first-steps")!.unlocked).toBe(true);
  });

  it("clamps progress at the target instead of overshooting past it", () => {
    const results = evaluateAchievements(stats({ flagsCaptured: 999 }));
    const flagMaster = results.find((a) => a.id === "flag-master")!;
    expect(flagMaster.unlocked).toBe(true);
    expect(flagMaster.progress).toBe(flagMaster.target);
  });

  it("treats rank as lower-is-better and null as never unlocked", () => {
    const noRank = evaluateAchievements(stats({ rank: null }));
    expect(noRank.find((a) => a.id === "rank-1")!.unlocked).toBe(false);

    const rank1 = evaluateAchievements(stats({ rank: 1 }));
    expect(rank1.find((a) => a.id === "rank-1")!.unlocked).toBe(true);
    expect(rank1.find((a) => a.id === "top-3")!.unlocked).toBe(true);

    const rank5 = evaluateAchievements(stats({ rank: 5 }));
    expect(rank5.find((a) => a.id === "rank-1")!.unlocked).toBe(false);
    expect(rank5.find((a) => a.id === "top-3")!.unlocked).toBe(false);
  });
});

describe("diffNewlyUnlocked", () => {
  it("returns nothing when no state changed", () => {
    const before = evaluateAchievements(stats({ scenariosCompleted: 1 }));
    const after = evaluateAchievements(stats({ scenariosCompleted: 1 }));
    expect(diffNewlyUnlocked(before, after)).toHaveLength(0);
  });

  it("returns exactly the achievements that flipped from locked to unlocked", () => {
    const before = evaluateAchievements(stats({ scenariosCompleted: 0, flagsCaptured: 0 }));
    const after = evaluateAchievements(stats({ scenariosCompleted: 1, flagsCaptured: 3 }));
    const diff = diffNewlyUnlocked(before, after);
    const ids = diff.map((a) => a.id).sort();
    expect(ids).toEqual(["first-steps", "flag-hunter"]);
  });

  it("does not re-report an achievement that was already unlocked before", () => {
    const before = evaluateAchievements(stats({ scenariosCompleted: 1 }));
    const after = evaluateAchievements(stats({ scenariosCompleted: 1, totalScore: 100 }));
    const diff = diffNewlyUnlocked(before, after);
    expect(diff.map((a) => a.id)).toEqual(["score-100"]);
  });
});
