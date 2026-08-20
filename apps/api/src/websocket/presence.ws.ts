import type { FastifyInstance } from "fastify";
import type { JwtPayload } from "@cybersim/types";
import { prisma } from "../db/client.js";

interface PlayerState {
  userId: string;
  username: string;
  color: string;
  room: string;
  x: number;
  z: number;
  socket: any;
}

interface PresenceEvent {
  type: "snapshot";
  room: string;
  players: { userId: string; username: string; color: string; x: number; z: number }[];
}

interface ChatEvent {
  type: "chat";
  room: string;
  userId: string;
  username: string;
  text: string;
}

interface EmoteEvent {
  type: "emote";
  room: string;
  userId: string;
  emoji: string;
}

const DEFAULT_ROOM = "world";
const MAX_CHAT_LENGTH = 140;
const ALLOWED_EMOJIS = new Set(["👋", "😂", "❤️", "😮"]);

// Players are scoped to a "room" string (the /world hub, or one of the FPV
// room slugs) so avatars only appear to other players physically in the same
// space. In-memory, single-server-instance only (same tradeoff as chat.ws.ts).
const players = new Map<string, PlayerState>();

function broadcastSnapshot(room: string) {
  const inRoom = Array.from(players.values()).filter((p) => p.room === room);
  const snapshot: PresenceEvent = {
    type: "snapshot",
    room,
    players: inRoom.map((p) => ({
      userId: p.userId,
      username: p.username,
      color: p.color,
      x: p.x,
      z: p.z,
    })),
  };
  const payload = JSON.stringify(snapshot);
  for (const p of inRoom) p.socket.send(payload);
}

// Ephemeral: not persisted anywhere, just relayed live to whoever is
// currently sharing the room, same spirit as a proximity voice line in a
// physical space rather than a logged chat channel.
function broadcastChat(room: string, from: PlayerState, text: string) {
  const event: ChatEvent = { type: "chat", room, userId: from.userId, username: from.username, text };
  const payload = JSON.stringify(event);
  for (const p of players.values()) {
    if (p.room === room) p.socket.send(payload);
  }
}

function broadcastEmote(room: string, from: PlayerState, emoji: string) {
  const event: EmoteEvent = { type: "emote", room, userId: from.userId, emoji };
  const payload = JSON.stringify(event);
  for (const p of players.values()) {
    if (p.room === room) p.socket.send(payload);
  }
}

export async function presenceWebSocket(app: FastifyInstance) {
  app.get("/ws/world-presence", { websocket: true }, (socket, req) => {
    const token = (req.query as { token?: string })?.token;
    const initialRoom = (req.query as { room?: string })?.room || DEFAULT_ROOM;
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
          room: initialRoom,
          x: 0,
          z: 0,
          socket,
        });
        broadcastSnapshot(initialRoom);
      })
      .catch(() => {
        players.set(userId, {
          userId,
          username: payload.username,
          color: "#22d3ee",
          room: initialRoom,
          x: 0,
          z: 0,
          socket,
        });
        broadcastSnapshot(initialRoom);
      });

    socket.on("message", (raw: Buffer) => {
      let message: unknown;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const player = players.get(userId);
      if (!player) return;

      const { type, text, emoji } = (message as { type?: string; text?: string; emoji?: string }) ?? {};
      if (type === "chat") {
        if (typeof text !== "string" || !text.trim()) return;
        broadcastChat(player.room, player, text.trim().slice(0, MAX_CHAT_LENGTH));
        return;
      }
      if (type === "emote") {
        if (typeof emoji !== "string" || !ALLOWED_EMOJIS.has(emoji)) return;
        broadcastEmote(player.room, player, emoji);
        return;
      }

      const { x, z, room } = (message as { x?: number; z?: number; room?: string }) ?? {};
      const prevRoom = player.room;
      if (typeof room === "string" && room !== prevRoom) {
        player.room = room;
      }
      if (typeof x === "number" && typeof z === "number") {
        player.x = Math.max(-20, Math.min(20, x));
        player.z = Math.max(-20, Math.min(20, z));
      }

      if (prevRoom !== player.room) broadcastSnapshot(prevRoom);
      broadcastSnapshot(player.room);
    });

    socket.on("close", () => {
      const player = players.get(userId);
      players.delete(userId);
      if (player) broadcastSnapshot(player.room);
    });
  });
}
