import { prisma } from "../../db/client.js";

export class ChatError extends Error {}

let worldConversationId: string | null = null;

export async function getWorldConversationId(): Promise<string> {
  if (worldConversationId) return worldConversationId;

  const existing = await prisma.conversation.findFirst({ where: { type: "world" } });
  if (existing) {
    worldConversationId = existing.id;
    return existing.id;
  }

  const created = await prisma.conversation.create({ data: { type: "world", name: "World Chat" } });
  worldConversationId = created.id;
  return created.id;
}

async function isMember(conversationId: string, userId: string): Promise<boolean> {
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  return membership?.status === "member";
}

export async function assertCanAccess(conversationId: string, userId: string): Promise<void> {
  const worldId = await getWorldConversationId();
  if (conversationId === worldId) return;
  if (!(await isMember(conversationId, userId))) {
    throw new ChatError("Not a member of this conversation");
  }
}

export interface ConversationSummary {
  id: string;
  type: string;
  name: string | null;
  lastMessage: { body: string; senderUsername: string; createdAt: Date } | null;
}

export async function listConversationsForUser(userId: string): Promise<ConversationSummary[]> {
  const worldId = await getWorldConversationId();

  const memberships = await prisma.conversationMember.findMany({
    where: { userId, status: "member" },
    include: { conversation: true },
  });

  const conversationIds = [worldId, ...memberships.map((m) => m.conversationId)];
  const conversations = [
    { id: worldId, type: "world", name: "World Chat" },
    ...memberships.map((m) => ({ id: m.conversation.id, type: m.conversation.type, name: m.conversation.name })),
  ];

  // For direct conversations, replace the (empty) name with the other participant's username.
  const directIds = conversations.filter((c) => c.type === "direct").map((c) => c.id);
  const otherMembers =
    directIds.length > 0
      ? await prisma.conversationMember.findMany({
          where: { conversationId: { in: directIds }, userId: { not: userId } },
          include: { user: { select: { username: true } } },
        })
      : [];
  const otherUsernameByConversation = new Map(otherMembers.map((m) => [m.conversationId, m.user.username]));

  const lastMessages = await prisma.message.findMany({
    where: { conversationId: { in: conversationIds } },
    orderBy: { createdAt: "desc" },
    include: { sender: { select: { username: true } } },
  });
  const lastMessageByConversation = new Map<string, (typeof lastMessages)[number]>();
  for (const msg of lastMessages) {
    if (!lastMessageByConversation.has(msg.conversationId)) lastMessageByConversation.set(msg.conversationId, msg);
  }

  return conversations.map((c) => {
    const last = lastMessageByConversation.get(c.id);
    return {
      id: c.id,
      type: c.type,
      name: c.type === "direct" ? (otherUsernameByConversation.get(c.id) ?? c.name) : c.name,
      lastMessage: last
        ? { body: last.body, senderUsername: last.sender.username, createdAt: last.createdAt }
        : null,
    };
  });
}

export async function getOrCreateDirectConversation(userId: string, targetUsername: string) {
  const target = await prisma.user.findUnique({ where: { username: targetUsername } });
  if (!target) throw new ChatError("User not found");
  if (target.id === userId) throw new ChatError("Cannot start a conversation with yourself");

  const myConversations = await prisma.conversationMember.findMany({
    where: { userId, status: "member", conversation: { type: "direct" } },
    select: { conversationId: true },
  });
  const theirConversations = await prisma.conversationMember.findMany({
    where: { userId: target.id, status: "member", conversation: { type: "direct" } },
    select: { conversationId: true },
  });
  const shared = new Set(theirConversations.map((c) => c.conversationId));
  const existingId = myConversations.find((c) => shared.has(c.conversationId))?.conversationId;
  if (existingId) return existingId;

  const conversation = await prisma.conversation.create({
    data: {
      type: "direct",
      createdBy: userId,
      members: { create: [{ userId, status: "member" }, { userId: target.id, status: "member" }] },
    },
  });
  return conversation.id;
}

export async function createGroupConversation(userId: string, name: string) {
  const conversation = await prisma.conversation.create({
    data: {
      type: "group",
      name,
      createdBy: userId,
      members: { create: [{ userId, status: "member" }] },
    },
  });
  return conversation.id;
}

export async function inviteToGroup(conversationId: string, inviterId: string, targetUsername: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation || conversation.type !== "group") throw new ChatError("Group not found");
  if (!(await isMember(conversationId, inviterId))) throw new ChatError("Not a member of this group");

  const target = await prisma.user.findUnique({ where: { username: targetUsername } });
  if (!target) throw new ChatError("User not found");

  const existing = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: target.id } },
  });
  if (existing) throw new ChatError("User is already a member or already invited");

  await prisma.conversationMember.create({
    data: { conversationId, userId: target.id, status: "invited" },
  });
}

export async function listPendingInvites(userId: string) {
  const invites = await prisma.conversationMember.findMany({
    where: { userId, status: "invited" },
    include: { conversation: true },
  });
  return invites.map((i) => ({ conversationId: i.conversationId, groupName: i.conversation.name ?? "Group" }));
}

export async function acceptInvite(userId: string, conversationId: string) {
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!membership || membership.status !== "invited") throw new ChatError("No pending invite for this group");

  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { status: "member" },
  });
}

export async function getMessages(conversationId: string, limit = 50) {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { sender: { select: { username: true } } },
  });
  return messages.reverse().map((m) => ({
    id: m.id,
    body: m.body,
    senderUsername: m.sender.username,
    createdAt: m.createdAt,
  }));
}

export async function sendMessage(conversationId: string, senderId: string, body: string) {
  const message = await prisma.message.create({
    data: { conversationId, senderId, body },
    include: { sender: { select: { username: true } } },
  });
  return { id: message.id, body: message.body, senderUsername: message.sender.username, createdAt: message.createdAt };
}
