import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { networkNodeSchema, networkEdgeSchema } from "@cybersim/types";
import { checkReachability } from "../services/network/network-engine.client.js";

const reachabilityRequestSchema = z.object({
  nodes: z.array(networkNodeSchema.pick({ id: true, type: true })),
  edges: z.array(networkEdgeSchema.pick({ source: true, target: true })),
  source: z.string().min(1),
  target: z.string().min(1),
});

export async function networkRoutes(app: FastifyInstance) {
  app.post("/api/network/reachability", { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = reachabilityRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const { nodes, edges, source, target } = parsed.data;

    try {
      const result = await checkReachability({ nodes, edges }, source, target);
      return reply.send(result);
    } catch (err) {
      req.log.error(err);
      return reply.status(502).send({ error: "Network engine unavailable" });
    }
  });
}
