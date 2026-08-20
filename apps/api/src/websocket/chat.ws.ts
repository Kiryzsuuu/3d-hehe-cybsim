import type { FastifyInstance } from "fastify";
import type { JwtPayload } from "@cybersim/types";
import { prisma } from "../db/client.js";
import { assertCanAccess, getWorldConversationId, sendMessage, ChatError } from "../services/chat/chat.service.js";
import { createWsRateLimiter } from "./wsRateLimit.js";
import { publish, onMessage, INSTANCE_ID } from "../services/redis/pubsub.js";

interface ChatEvent {
  type: "message" | "error";
  conversationId?: string;
  id?: string;
  body?: string;
  senderUsername?: string;
  createdAt?: string;
}

const MESSAGE_CHANNEL = "chat:message";

// Per-server-instance connection registry: userId -> sockets (a user can
// have multiple tabs open). This alone only reaches users connected to THIS
// process; MESSAGE_CHANNEL below fans a sent message out to every other
// instance too, so a message still reaches a recipient connected elsewhere
// behind a load balancer.
const connectionsByUser = new Map<string, Set<any>>();

function register(userId: string, socket: any) {
  if (!connectionsByUser.has(userId)) connectionsByUser.set(userId, new Set());
  connectionsByUser.get(userId)!.add(socket);
}

function unregister(userId: string, socket: any) {
  const set = connectionsByUser.get(userId);
  if (!set) return;
  set.delete(socket);
  if (set.size === 0) connectionsByUser.delete(userId);
}

function sendTo(userId: string, event: ChatEvent) {
  const set = connectionsByUser.get(userId);
  if (!set) return;
  const payload = JSON.stringify(event);
  for (const socket of set) socket.send(payload);
}

interface RelayedMessage {
  event: ChatEvent;
  recipientUserIds: string[] | "all";
}

let crossInstanceHandlerRegistered = false;

// Registered once per process. Delivers a message sent on a DIFFERENT
// instance to whichever of its recipients happen to be connected to this
// one — this instance's own sends already reached its local sockets
// directly at the point of sending (see the "message" handler below), so
// self-published messages are skipped here to avoid double delivery.
function registerCrossInstanceHandlerOnce() {
  if (crossInstanceHandlerRegistered) return;
  crossInstanceHandlerRegistered = true;

  onMessage<RelayedMessage>(MESSAGE_CHANNEL, ({ event, recipientUserIds }, fromInstanceId) => {
    if (fromInstanceId === INSTANCE_ID) return;
    if (recipientUserIds === "all") {
      for (const uid of connectionsByUser.keys()) sendTo(uid, event);
    } else {
      for (const uid of recipientUserIds) sendTo(uid, event);
    }
  }).catch((err) => console.error("[chat.ws] subscribe failed:", err));
}

export async function chatWebSocket(app: FastifyInstance) {
  registerCrossInstanceHandlerOnce();

  app.get("/ws/chat", { websocket: true }, (socket, req) => {
    const token = (req.query as { token?: string })?.token;
    let payload: JwtPayload;
    try {
      if (!token) throw new Error("missing token");
      payload = app.jwt.verify(token);
    } catch {
      socket.send(JSON.stringify({ type: "error", body: "Unauthorized" } satisfies ChatEvent));
      socket.close();
      return;
    }
    const userId = payload.sub;
    register(userId, socket);
    // Matches the REST /api/chat send-message limit (chat.routes.ts, 20/min)
    // so a client can't bypass it just by going through the socket instead.
    const allowSend = createWsRateLimiter(20, 60_000);

    socket.on("message", async (raw: Buffer) => {
      let message: unknown;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        socket.send(JSON.stringify({ type: "error", body: "Malformed message" } satisfies ChatEvent));
        return;
      }

      if (!allowSend()) {
        socket.send(JSON.stringify({ type: "error", body: "Too many messages, slow down" } satisfies ChatEvent));
        return;
      }

      const { conversationId, body } = (message as { conversationId?: string; body?: string }) ?? {};
      if (typeof conversationId !== "string" || typeof body !== "string" || !body.trim() || body.length > 2000) {
        socket.send(JSON.stringify({ type: "error", body: "Invalid message" } satisfies ChatEvent));
        return;
      }

      try {
        await assertCanAccess(conversationId, userId);
        const saved = await sendMessage(conversationId, userId, body.trim());

        const event: ChatEvent = {
          type: "message",
          conversationId,
          id: saved.id,
          body: saved.body,
          senderUsername: saved.senderUsername,
          createdAt: saved.createdAt.toISOString(),
        };

        const worldId = await getWorldConversationId();
        if (conversationId === worldId) {
          for (const uid of connectionsByUser.keys()) sendTo(uid, event);
          void publish<RelayedMessage>(MESSAGE_CHANNEL, { event, recipientUserIds: "all" });
        } else {
          const members = await prisma.conversationMember.findMany({
            where: { conversationId, status: "member" },
            select: { userId: true },
          });
          for (const m of members) sendTo(m.userId, event);
          void publish<RelayedMessage>(MESSAGE_CHANNEL, {
            event,
            recipientUserIds: members.map((m) => m.userId),
          });
        }
      } catch (err) {
        socket.send(
          JSON.stringify({
            type: "error",
            body: err instanceof ChatError ? err.message : "Failed to send message",
          } satisfies ChatEvent)
        );
      }
    });

    socket.on("close", () => unregister(userId, socket));
  });
}
