import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { JwtPayload } from "@cybersim/types";
import {
  getWorldConversationId,
  listConversationsForUser,
  getOrCreateDirectConversation,
  createGroupConversation,
  inviteToGroup,
  listPendingInvites,
  acceptInvite,
  assertCanAccess,
  getMessages,
  ChatError,
} from "../services/chat/chat.service.js";

const usernameSchema = z.object({ username: z.string().min(3).max(32) });
const groupNameSchema = z.object({ name: z.string().min(1).max(64) });

export async function chatRoutes(app: FastifyInstance) {
  app.get("/api/chat/conversations", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as JwtPayload;
    const conversations = await listConversationsForUser(sub);
    return reply.send({ conversations });
  });

  app.get(
    "/api/chat/conversations/:id/messages",
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const { sub } = req.user as JwtPayload;
      try {
        await assertCanAccess(id, sub);
      } catch (err) {
        return reply.status(403).send({ error: err instanceof ChatError ? err.message : "Forbidden" });
      }
      const messages = await getMessages(id);
      return reply.send({ messages });
    }
  );

  app.post(
    "/api/chat/conversations/direct",
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { sub } = req.user as JwtPayload;
      const parsed = usernameSchema.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: "Invalid input" });
      try {
        const conversationId = await getOrCreateDirectConversation(sub, parsed.data.username);
        return reply.send({ conversationId });
      } catch (err) {
        return reply.status(400).send({ error: err instanceof ChatError ? err.message : "Failed" });
      }
    }
  );

  app.post(
    "/api/chat/conversations/group",
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { sub } = req.user as JwtPayload;
      const parsed = groupNameSchema.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: "Invalid input" });
      const conversationId = await createGroupConversation(sub, parsed.data.name);
      return reply.send({ conversationId });
    }
  );

  app.post(
    "/api/chat/conversations/:id/invite",
    { onRequest: [app.authenticate], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const { sub } = req.user as JwtPayload;
      const parsed = usernameSchema.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: "Invalid input" });
      try {
        await inviteToGroup(id, sub, parsed.data.username);
        return reply.send({ invited: true });
      } catch (err) {
        return reply.status(400).send({ error: err instanceof ChatError ? err.message : "Failed" });
      }
    }
  );

  app.get("/api/chat/invites", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as JwtPayload;
    const invites = await listPendingInvites(sub);
    return reply.send({ invites });
  });

  app.post(
    "/api/chat/invites/:conversationId/accept",
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { conversationId } = req.params as { conversationId: string };
      const { sub } = req.user as JwtPayload;
      try {
        await acceptInvite(sub, conversationId);
        return reply.send({ accepted: true });
      } catch (err) {
        return reply.status(400).send({ error: err instanceof ChatError ? err.message : "Failed" });
      }
    }
  );

  app.get("/api/chat/world-id", async (_req, reply) => {
    const worldId = await getWorldConversationId();
    return reply.send({ worldId });
  });
}
