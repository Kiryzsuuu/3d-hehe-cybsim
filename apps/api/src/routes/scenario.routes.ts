import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { submitFlagSchema, type JwtPayload } from "@cybersim/types";
import {
  listScenarios,
  getScenarioBySlug,
  listProgressForUser,
  startScenario,
  completeScenario,
  submitFlag,
  getLeaderboard,
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

    // Never leak the flag hash to the client, even for CTF scenarios.
    const { flag: _flag, ...safeData } = (scenario.data as Record<string, unknown>) ?? {};
    return reply.send({ scenario: { ...scenario, data: safeData } });
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

  app.post(
    "/api/scenarios/:slug/submit-flag",
    {
      onRequest: [app.authenticate],
      // Flags are guessable secrets, cap attempts harder than the global limit.
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const { sub } = req.user as JwtPayload;

      const parsed = submitFlagSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      }

      const scenario = await getScenarioBySlug(slug);
      if (!scenario) return reply.status(404).send({ error: "Scenario not found" });

      const result = await submitFlag(sub, scenario.id, scenario.data, parsed.data.flag);
      return reply.send(result);
    }
  );

  app.get("/api/leaderboard", async (_req, reply) => {
    const leaderboard = await getLeaderboard();
    return reply.send({ leaderboard });
  });
}
