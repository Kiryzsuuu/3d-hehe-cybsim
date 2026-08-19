import type { FastifyInstance } from "fastify";
import { registerSchema, loginSchema } from "@cybersim/types";
import { registerUser, verifyUser, AuthError } from "../services/auth/auth.service.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/register", async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid input", details: parsed.error.flatten() });
    }
    try {
      const user = await registerUser(parsed.data);
      const token = app.jwt.sign({ sub: user.id, email: user.email, username: user.username });
      return reply.status(201).send({ user, token });
    } catch (err) {
      if (err instanceof AuthError) return reply.status(409).send({ error: err.message });
      req.log.error(err);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid input", details: parsed.error.flatten() });
    }
    try {
      const user = await verifyUser(parsed.data);
      const token = app.jwt.sign({ sub: user.id, email: user.email, username: user.username });
      return reply.send({ user, token });
    } catch (err) {
      if (err instanceof AuthError) return reply.status(401).send({ error: err.message });
      req.log.error(err);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  app.get("/api/auth/me", { onRequest: [app.authenticate] }, async (req, reply) => {
    return reply.send({ user: req.user });
  });
}
