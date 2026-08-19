import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { JwtPayload } from "@cybersim/types";
import { createRoom, joinRoom, getRoomState, RoomError } from "../services/room/room.service.js";

const createRoomSchema = z.object({ scenarioSlug: z.string().min(1) });

export async function roomRoutes(app: FastifyInstance) {
  app.post("/api/rooms", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as JwtPayload;
    const parsed = createRoomSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid input" });
    try {
      const room = await createRoom(sub, parsed.data.scenarioSlug);
      return reply.send({ code: room.code });
    } catch (err) {
      return reply.status(400).send({ error: err instanceof RoomError ? err.message : "Failed" });
    }
  });

  app.post("/api/rooms/:code/join", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { code } = req.params as { code: string };
    const { sub } = req.user as JwtPayload;
    try {
      await joinRoom(sub, code);
      return reply.send({ joined: true });
    } catch (err) {
      return reply.status(400).send({ error: err instanceof RoomError ? err.message : "Failed" });
    }
  });

  app.get("/api/rooms/:code", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { code } = req.params as { code: string };
    const { sub } = req.user as JwtPayload;
    try {
      const state = await getRoomState(code, sub);
      return reply.send({ state });
    } catch (err) {
      return reply.status(404).send({ error: err instanceof RoomError ? err.message : "Not found" });
    }
  });
}
