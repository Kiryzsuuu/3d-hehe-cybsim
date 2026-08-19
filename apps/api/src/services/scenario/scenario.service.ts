import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "../../db/client.js";

interface ScenarioFlagData {
  flag?: { hash: string; points: number };
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function listScenarios() {
  return prisma.scenario.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true, title: true, level: true, description: true },
  });
}

export async function getScenarioBySlug(slug: string) {
  return prisma.scenario.findUnique({ where: { slug } });
}

export async function listProgressForUser(userId: string) {
  return prisma.progress.findMany({
    where: { userId },
    include: { scenario: { select: { slug: true, title: true, level: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function startScenario(userId: string, scenarioId: string) {
  return prisma.progress.upsert({
    where: { userId_scenarioId: { userId, scenarioId } },
    update: {},
    create: { userId, scenarioId, status: "in_progress", score: 0 },
  });
}

export async function completeScenario(userId: string, scenarioId: string, score: number) {
  return prisma.progress.upsert({
    where: { userId_scenarioId: { userId, scenarioId } },
    update: { status: "completed", score, completedAt: new Date() },
    create: { userId, scenarioId, status: "completed", score, completedAt: new Date() },
  });
}

export interface SubmitFlagResult {
  correct: boolean;
  alreadyCaptured: boolean;
  pointsAwarded: number;
}

export async function submitFlag(
  userId: string,
  scenarioId: string,
  scenarioData: unknown,
  submittedFlag: string
): Promise<SubmitFlagResult> {
  const flagConfig = (scenarioData as ScenarioFlagData)?.flag;
  if (!flagConfig) {
    return { correct: false, alreadyCaptured: false, pointsAwarded: 0 };
  }

  const submittedHash = sha256Hex(submittedFlag.trim());
  const correct = hashesMatch(submittedHash, flagConfig.hash);
  if (!correct) {
    return { correct: false, alreadyCaptured: false, pointsAwarded: 0 };
  }

  const existing = await prisma.progress.findUnique({ where: { userId_scenarioId: { userId, scenarioId } } });
  if (existing?.flagCaptured) {
    return { correct: true, alreadyCaptured: true, pointsAwarded: 0 };
  }

  await prisma.progress.upsert({
    where: { userId_scenarioId: { userId, scenarioId } },
    update: { flagCaptured: true, score: (existing?.score ?? 0) + flagConfig.points },
    create: {
      userId,
      scenarioId,
      status: "in_progress",
      score: flagConfig.points,
      flagCaptured: true,
    },
  });

  return { correct: true, alreadyCaptured: false, pointsAwarded: flagConfig.points };
}

async function rankedTotals(): Promise<{ userId: string; totalScore: number }[]> {
  const results = await prisma.progress.groupBy({ by: ["userId"], _sum: { score: true } });
  return results
    .map((r) => ({ userId: r.userId, totalScore: r._sum.score ?? 0 }))
    .filter((r) => r.totalScore > 0)
    .sort((a, b) => b.totalScore - a.totalScore);
}

export async function getLeaderboard(limit = 20) {
  const totals = await rankedTotals();
  const users = await prisma.user.findMany({
    where: { id: { in: totals.map((r) => r.userId) } },
    select: { id: true, username: true },
  });
  const usernameById = new Map(users.map((u) => [u.id, u.username]));

  return totals.slice(0, limit).map((r) => ({ username: usernameById.get(r.userId) ?? "unknown", totalScore: r.totalScore }));
}

export interface ProfileStats {
  totalScore: number;
  scenariosCompleted: number;
  scenariosInProgress: number;
  flagsCaptured: number;
  rank: number | null;
}

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const progress = await prisma.progress.findMany({ where: { userId } });
  const totalScore = progress.reduce((sum, p) => sum + p.score, 0);
  const scenariosCompleted = progress.filter((p) => p.status === "completed").length;
  const scenariosInProgress = progress.filter((p) => p.status === "in_progress").length;
  const flagsCaptured = progress.filter((p) => p.flagCaptured).length;

  const totals = await rankedTotals();
  const rankIndex = totals.findIndex((r) => r.userId === userId);
  const rank = rankIndex === -1 ? null : rankIndex + 1;

  return { totalScore, scenariosCompleted, scenariosInProgress, flagsCaptured, rank };
}
