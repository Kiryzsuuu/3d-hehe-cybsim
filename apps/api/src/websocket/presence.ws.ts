import type { FastifyInstance } from "fastify";
import type { JwtPayload } from "@cybersim/types";
import { prisma } from "../db/client.js";
import { createWsRateLimiter } from "./wsRateLimit.js";
import { publish, onMessage, INSTANCE_ID } from "../services/redis/pubsub.js";

interface PlayerState {
  userId: string;
  username: string;
  color: string;
  room: string;
  x: number;
  z: number;
  socket: any;
}

type RemotePlayer = { userId: string; username: string; color: string; x: number; z: number };

interface PresenceEvent {
  type: "snapshot";
  room: string;
  players: RemotePlayer[];
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

const SNAPSHOT_CHANNEL = "presence:snapshot";
const CHAT_CHANNEL = "presence:chat";
const EMOTE_CHANNEL = "presence:emote";

// Sockets connected to THIS server instance only — a Node process can't
// hold a socket belonging to another process, so this was always inherently
// per-instance. In a single-instance deployment this used to be the only
// source of truth, which meant two players landing on different instances
// behind a load balancer would never see each other. remoteFragments below
// closes that gap.
const players = new Map<string, PlayerState>();

// Other instances' player lists for a room, published to SNAPSHOT_CHANNEL
// whenever their local state changes. Keyed by room -> instanceId -> that
// instance's players in that room, so a merged snapshot for a room is just
// this instance's local players plus every fragment on file for that room.
const remoteFragments = new Map<string, Map<string, RemotePlayer[]>>();

function localPlayersInRoom(room: string): RemotePlayer[] {
  return Array.from(players.values())
    .filter((p) => p.room === room)
    .map((p) => ({ userId: p.userId, username: p.username, color: p.color, x: p.x, z: p.z }));
}

function mergedPlayersInRoom(room: string): RemotePlayer[] {
  const merged = localPlayersInRoom(room);
  const fragments = remoteFragments.get(room);
  if (fragments) {
    for (const list of fragments.values()) merged.push(...list);
  }
  return merged;
}

function sendSnapshotToLocalSockets(room: string) {
  const snapshot: PresenceEvent = { type: "snapshot", room, players: mergedPlayersInRoom(room) };
  const payload = JSON.stringify(snapshot);
  for (const p of players.values()) {
    if (p.room === room) p.socket.send(payload);
  }
}

// Publishes this instance's local player list for `room` so other instances
// can merge it into their own view, then updates every local socket in that
// room with the freshly merged snapshot. Fire-and-forget on the publish
// side: if Redis is down, local players still see each other exactly as
// before (this function's second half is unaffected), they just won't see
// players connected to other instances.
function broadcastSnapshot(room: string) {
  sendSnapshotToLocalSockets(room);
  void publish(SNAPSHOT_CHANNEL, { room, players: localPlayersInRoom(room) });
}

// Delivered straight to this instance's local sockets in the room (matches
// pre-Redis behavior exactly), then published so other instances' local
// sockets get it too. Ephemeral by design — never persisted, never
// replayed to a late joiner, same spirit as a spoken line in a shared room.
function broadcastChat(room: string, from: PlayerState, text: string) {
  const event: ChatEvent = { type: "chat", room, userId: from.userId, username: from.username, text };
  const payloadStr = JSON.stringify(event);
  for (const p of players.values()) {
    if (p.room === room) p.socket.send(payloadStr);
  }
  void publish(CHAT_CHANNEL, { room, userId: from.userId, username: from.username, text });
}

function broadcastEmote(room: string, from: PlayerState, emoji: string) {
  const event: EmoteEvent = { type: "emote", room, userId: from.userId, emoji };
  const payloadStr = JSON.stringify(event);
  for (const p of players.values()) {
    if (p.room === room) p.socket.send(payloadStr);
  }
  void publish(EMOTE_CHANNEL, { room, userId: from.userId, emoji });
}

let crossInstanceHandlersRegistered = false;

// Registered once per process (not per connection). Any message here comes
// from a DIFFERENT instance — this instance's own publishes are filtered
// out by instanceId, since its own local sockets were already served
// directly at the point of the original event (see broadcastChat etc.
// above), so relaying them again here would double-deliver.
function registerCrossInstanceHandlersOnce() {
  if (crossInstanceHandlersRegistered) return;
  crossInstanceHandlersRegistered = true;

  onMessage<{ room: string; players: RemotePlayer[] }>(SNAPSHOT_CHANNEL, (payload, fromInstanceId) => {
    if (fromInstanceId === INSTANCE_ID) return;
    if (!remoteFragments.has(payload.room)) remoteFragments.set(payload.room, new Map());
    remoteFragments.get(payload.room)!.set(fromInstanceId, payload.players);
    sendSnapshotToLocalSockets(payload.room);
  }).catch((err) => console.error("[presence.ws] snapshot subscribe failed:", err));

  onMessage<{ room: string; userId: string; username: string; text: string }>(CHAT_CHANNEL, (payload, fromInstanceId) => {
    if (fromInstanceId === INSTANCE_ID) return;
    const event: ChatEvent = { type: "chat", ...payload };
    const payloadStr = JSON.stringify(event);
    for (const p of players.values()) {
      if (p.room === payload.room) p.socket.send(payloadStr);
    }
  }).catch((err) => console.error("[presence.ws] chat subscribe failed:", err));

  onMessage<{ room: string; userId: string; emoji: string }>(EMOTE_CHANNEL, (payload, fromInstanceId) => {
    if (fromInstanceId === INSTANCE_ID) return;
    const event: EmoteEvent = { type: "emote", ...payload };
    const payloadStr = JSON.stringify(event);
    for (const p of players.values()) {
      if (p.room === payload.room) p.socket.send(payloadStr);
    }
  }).catch((err) => console.error("[presence.ws] emote subscribe failed:", err));
}

export async function presenceWebSocket(app: FastifyInstance) {
  registerCrossInstanceHandlersOnce();

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
    // Position updates are already throttled client-side to ~150ms, but a
    // modified/malicious client could ignore that, so the server caps it too
    // (generously, since legitimate movement is naturally chatty). Chat and
    // emotes get much tighter limits since a burst there is pure spam, not
    // gameplay.
    const allowMove = createWsRateLimiter(20, 1000);
    const allowChat = createWsRateLimiter(3, 5000);
    const allowEmote = createWsRateLimiter(6, 5000);

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
        if (!allowChat()) return;
        if (typeof text !== "string" || !text.trim()) return;
        broadcastChat(player.room, player, text.trim().slice(0, MAX_CHAT_LENGTH));
        return;
      }
      if (type === "emote") {
        if (!allowEmote()) return;
        if (typeof emoji !== "string" || !ALLOWED_EMOJIS.has(emoji)) return;
        broadcastEmote(player.room, player, emoji);
        return;
      }

      if (!allowMove()) return;
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
