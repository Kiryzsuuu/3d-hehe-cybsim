import type { FastifyInstance } from "fastify";
import type { JwtPayload } from "@cybersim/types";
import { prisma } from "../db/client.js";
import { assertCanAccess, getWorldConversationId, sendMessage, ChatError } from "../services/chat/chat.service.js";

interface ChatEvent {
  type: "message" | "error";
  conversationId?: string;
  id?: string;
  body?: string;
  senderUsername?: string;
  createdAt?: string;
}

// Per-server-instance connection registry: userId -> sockets (a user can have
// multiple tabs open). Fine for a single API instance; a multi-instance
// deployment would need a pub/sub layer (Redis) to fan out across processes.
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

export async function chatWebSocket(app: FastifyInstance) {
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

    socket.on("message", async (raw: Buffer) => {
      let message: unknown;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        socket.send(JSON.stringify({ type: "error", body: "Malformed message" } satisfies ChatEvent));
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
        } else {
          const members = await prisma.conversationMember.findMany({
            where: { conversationId, status: "member" },
            select: { userId: true },
          });
          for (const m of members) sendTo(m.userId, event);
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
