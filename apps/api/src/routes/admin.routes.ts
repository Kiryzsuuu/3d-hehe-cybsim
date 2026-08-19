import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { JwtPayload } from "@cybersim/types";
import { listUsersForAdmin, getPlatformStats, setUserRole } from "../services/admin/admin.service.js";

const setRoleSchema = z.object({ role: z.enum(["user", "admin"]) });

export async function adminRoutes(app: FastifyInstance) {
  app.get("/api/admin/users", { onRequest: [app.authenticate, app.requireAdmin] }, async (_req, reply) => {
    const users = await listUsersForAdmin();
    return reply.send({ users });
  });

  app.get("/api/admin/stats", { onRequest: [app.authenticate, app.requireAdmin] }, async (_req, reply) => {
    const stats = await getPlatformStats();
    return reply.send({ stats });
  });

  app.post(
    "/api/admin/users/:id/role",
    { onRequest: [app.authenticate, app.requireAdmin] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const { sub } = req.user as JwtPayload;
      const parsed = setRoleSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      }
      if (id === sub && parsed.data.role !== "admin") {
        return reply.status(400).send({ error: "Cannot demote your own account" });
      }
      const user = await setUserRole(id, parsed.data.role);
      return reply.send({ user: { id: user.id, username: user.username, role: user.role } });
    }
  );
}
