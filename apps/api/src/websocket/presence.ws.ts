import type { FastifyInstance } from "fastify";
import type { JwtPayload } from "@cybersim/types";
import { prisma } from "../db/client.js";

interface PlayerState {
  userId: string;
  username: string;
  color: string;
  x: number;
  z: number;
  socket: any;
}

interface PresenceEvent {
  type: "snapshot";
  players: { userId: string; username: string; color: string; x: number; z: number }[];
}

// Single shared room ("world"). Position updates overwrite state and trigger
// a broadcast of everyone's latest position to everyone still connected.
// In-memory, single-server-instance only (same tradeoff as chat.ws.ts).
const players = new Map<string, PlayerState>();

function broadcastSnapshot() {
  const snapshot: PresenceEvent = {
    type: "snapshot",
    players: Array.from(players.values()).map((p) => ({
      userId: p.userId,
      username: p.username,
      color: p.color,
      x: p.x,
      z: p.z,
    })),
  };
  const payload = JSON.stringify(snapshot);
  for (const p of players.values()) p.socket.send(payload);
}

export async function presenceWebSocket(app: FastifyInstance) {
  app.get("/ws/world-presence", { websocket: true }, (socket, req) => {
    const token = (req.query as { token?: string })?.token;
    let payload: JwtPayload;
    try {
      if (!token) throw new Error("missing token");
      payload = app.jwt.verify(token);
    } catch {
      socket.close();
      return;
    }

    const userId = payload.sub;

    prisma.user
      .findUnique({ where: { id: userId }, select: { avatarColor: true } })
      .then((user) => {
        players.set(userId, {
          userId,
          username: payload.username,
          color: user?.avatarColor ?? "#22d3ee",
          x: 0,
          z: 0,
          socket,
        });
        broadcastSnapshot();
      })
      .catch(() => {
        players.set(userId, { userId, username: payload.username, color: "#22d3ee", x: 0, z: 0, socket });
        broadcastSnapshot();
      });

    socket.on("message", (raw: Buffer) => {
      let message: unknown;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const { x, z } = (message as { x?: number; z?: number }) ?? {};
      if (typeof x !== "number" || typeof z !== "number") return;
      const player = players.get(userId);
      if (!player) return;
      player.x = Math.max(-20, Math.min(20, x));
      player.z = Math.max(-20, Math.min(20, z));
      broadcastSnapshot();
    });

    socket.on("close", () => {
      players.delete(userId);
      broadcastSnapshot();
    });
  });
}
