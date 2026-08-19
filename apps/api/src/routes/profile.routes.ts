import type { FastifyInstance } from "fastify";
import type { JwtPayload } from "@cybersim/types";
import { prisma } from "../db/client.js";
import { getProfileStats, listProgressForUser } from "../services/scenario/scenario.service.js";

export async function profileRoutes(app: FastifyInstance) {
  app.get("/api/profile", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: sub },
      select: { id: true, email: true, username: true, role: true, createdAt: true },
    });
    if (!user) return reply.status(404).send({ error: "User not found" });

    const [stats, history] = await Promise.all([getProfileStats(sub), listProgressForUser(sub)]);

    return reply.send({ user, stats, history });
  });
}
