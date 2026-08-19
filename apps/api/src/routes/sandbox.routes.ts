import type { FastifyInstance } from "fastify";
import type { JwtPayload } from "@cybersim/types";
import { createUserSandbox, stopUserSandbox, getUserSandboxStatus } from "../services/sandbox/sandbox.service.js";

export async function sandboxRoutes(app: FastifyInstance) {
  app.get("/api/sandbox", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as JwtPayload;
    try {
      const status = await getUserSandboxStatus(sub);
      return reply.send(status);
    } catch (err) {
      req.log.error(err);
      return reply.status(502).send({ error: "Docker unavailable" });
    }
  });

  app.post(
    "/api/sandbox/start",
    { onRequest: [app.authenticate], config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const { sub } = req.user as JwtPayload;
      try {
        const status = await createUserSandbox(sub);
        return reply.send(status);
      } catch (err) {
        req.log.error(err);
        return reply.status(502).send({ error: "Failed to start sandbox" });
      }
    }
  );

  app.post("/api/sandbox/stop", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as JwtPayload;
    try {
      const status = await stopUserSandbox(sub);
      return reply.send(status);
    } catch (err) {
      req.log.error(err);
      return reply.status(502).send({ error: "Failed to stop sandbox" });
    }
  });
}
