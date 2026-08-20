import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { JwtPayload } from "@cybersim/types";
import { prisma } from "../db/client.js";
import { getProfileStats, listProgressForUser } from "../services/scenario/scenario.service.js";
import { evaluateAchievements } from "../services/achievement/achievement.service.js";

const AVATAR_COLORS = [
  "#22d3ee",
  "#f472b6",
  "#a855f7",
  "#22c55e",
  "#facc15",
  "#f97316",
  "#ef4444",
  "#3b82f6",
  "#e879f9",
  "#94a3b8",
];

const avatarSchema = z.object({ color: z.enum(AVATAR_COLORS as [string, ...string[]]) });

export async function profileRoutes(app: FastifyInstance) {
  app.get("/api/profile", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: sub },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        avatarColor: true,
        hasSeenTutorial: true,
        createdAt: true,
      },
    });
    if (!user) return reply.status(404).send({ error: "User not found" });

    const [stats, history] = await Promise.all([getProfileStats(sub), listProgressForUser(sub)]);
    const achievements = evaluateAchievements(stats);

    return reply.send({ user, stats, history, achievements });
  });

  app.get("/api/profile/avatar-colors", async (_req, reply) => {
    return reply.send({ colors: AVATAR_COLORS });
  });

  app.post("/api/profile/avatar", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as JwtPayload;
    const parsed = avatarSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid input" });

    const user = await prisma.user.update({
      where: { id: sub },
      data: { avatarColor: parsed.data.color },
      select: { id: true, avatarColor: true },
    });
    return reply.send({ user });
  });

  app.post("/api/profile/tutorial-complete", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as JwtPayload;
    const user = await prisma.user.update({
      where: { id: sub },
      data: { hasSeenTutorial: true },
      select: { id: true, hasSeenTutorial: true },
    });
    return reply.send({ user });
  });
}
