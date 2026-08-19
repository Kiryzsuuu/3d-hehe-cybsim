import { prisma } from "../../db/client.js";

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
