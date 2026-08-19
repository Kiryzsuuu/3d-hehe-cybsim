import { prisma } from "../../db/client.js";

export interface AdminUserRow {
  id: string;
  email: string;
  username: string;
  role: string;
  createdAt: Date;
  totalScore: number;
  scenariosCompleted: number;
}

export async function listUsersForAdmin(): Promise<AdminUserRow[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, username: true, role: true, createdAt: true },
  });

  const progressByUser = await prisma.progress.groupBy({
    by: ["userId"],
    _sum: { score: true },
    _count: { _all: true },
  });
  const completedByUser = await prisma.progress.groupBy({
    by: ["userId"],
    where: { status: "completed" },
    _count: { _all: true },
  });

  const scoreMap = new Map(progressByUser.map((p) => [p.userId, p._sum.score ?? 0]));
  const completedMap = new Map(completedByUser.map((p) => [p.userId, p._count._all]));

  return users.map((u) => ({
    ...u,
    totalScore: scoreMap.get(u.id) ?? 0,
    scenariosCompleted: completedMap.get(u.id) ?? 0,
  }));
}

export interface PlatformStats {
  totalUsers: number;
  totalScenarios: number;
  totalCompletions: number;
  totalMessages: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const [totalUsers, totalScenarios, totalCompletions, totalMessages] = await Promise.all([
    prisma.user.count(),
    prisma.scenario.count(),
    prisma.progress.count({ where: { status: "completed" } }),
    prisma.message.count(),
  ]);
  return { totalUsers, totalScenarios, totalCompletions, totalMessages };
}

export async function setUserRole(userId: string, role: "user" | "admin") {
  return prisma.user.update({ where: { id: userId }, data: { role } });
}
