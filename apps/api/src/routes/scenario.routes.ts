import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { JwtPayload } from "@cybersim/types";
import {
  listScenarios,
  getScenarioBySlug,
  listProgressForUser,
  startScenario,
  completeScenario,
} from "../services/scenario/scenario.service.js";

const completeBodySchema = z.object({
  score: z.number().int().min(0).max(1000),
});

export async function scenarioRoutes(app: FastifyInstance) {
  app.get("/api/scenarios", async (_req, reply) => {
    const scenarios = await listScenarios();
    return reply.send({ scenarios });
  });

  app.get("/api/scenarios/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const scenario = await getScenarioBySlug(slug);
    if (!scenario) return reply.status(404).send({ error: "Scenario not found" });
    return reply.send({ scenario });
  });

  app.get("/api/progress", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as JwtPayload;
    const progress = await listProgressForUser(sub);
    return reply.send({ progress });
  });

  app.post("/api/scenarios/:slug/start", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const { sub } = req.user as JwtPayload;

    const scenario = await getScenarioBySlug(slug);
    if (!scenario) return reply.status(404).send({ error: "Scenario not found" });

    const progress = await startScenario(sub, scenario.id);
    return reply.send({ progress });
  });

  app.post("/api/scenarios/:slug/complete", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const { sub } = req.user as JwtPayload;

    const parsed = completeBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const scenario = await getScenarioBySlug(slug);
    if (!scenario) return reply.status(404).send({ error: "Scenario not found" });

    const progress = await completeScenario(sub, scenario.id, parsed.data.score);
    return reply.send({ progress });
  });
}
