import type { FastifyInstance } from "fastify";
import type { JwtPayload } from "@cybersim/types";
import { createUserSandbox, stopUserSandbox, getUserSandboxStatus } from "../services/sandbox/sandbox.service.js";
import { startDvwaForUser, stopDvwaForUser, getDvwaStatus } from "../services/sandbox/dvwa.service.js";
import { describeDockerError } from "../services/sandbox/docker-error.js";

export async function sandboxRoutes(app: FastifyInstance) {
  app.get("/api/sandbox", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as JwtPayload;
    try {
      const status = await getUserSandboxStatus(sub);
      return reply.send(status);
    } catch (err) {
      req.log.error(err);
      const { status, message } = describeDockerError(err);
      return reply.status(status).send({ error: message });
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
        const { status, message } = describeDockerError(err);
        return reply.status(status).send({ error: message });
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
      const { status, message } = describeDockerError(err);
      return reply.status(status).send({ error: message });
    }
  });

  app.get("/api/sandbox/dvwa", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as JwtPayload;
    try {
      const status = await getDvwaStatus(sub);
      return reply.send(status);
    } catch (err) {
      req.log.error(err);
      const { status, message } = describeDockerError(err);
      return reply.status(status).send({ error: message });
    }
  });

  app.post(
    "/api/sandbox/dvwa/start",
    { onRequest: [app.authenticate], config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const { sub } = req.user as JwtPayload;
      try {
        const status = await startDvwaForUser(sub);
        return reply.send(status);
      } catch (err) {
        req.log.error(err);
        const { status, message } = describeDockerError(err);
        return reply.status(status).send({ error: message });
      }
    }
  );

  app.post("/api/sandbox/dvwa/stop", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as JwtPayload;
    try {
      const status = await stopDvwaForUser(sub);
      return reply.send(status);
    } catch (err) {
      req.log.error(err);
      const { status, message } = describeDockerError(err);
      return reply.status(status).send({ error: message });
    }
  });
}
