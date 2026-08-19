"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  listConversations,
  getMessages,
  startDirectConversation,
  createGroup,
  inviteToGroup,
  listInvites,
  acceptInvite,
  type ConversationSummary,
  type ChatMessage,
  type PendingInvite,
} from "@/lib/api";
import { useChatSocket } from "@/hooks/useChatSocket";
import { useRequireAuth } from "@/hooks/useAuth";
import AppHeader from "@/components/layout/AppHeader";

const TYPE_ICON: Record<string, string> = { world: "🌐", direct: "💬", group: "👥" };

export default function ChatPage() {
  const { ready, user } = useRequireAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, ChatMessage[]>>({});
  const [input, setInput] = useState("");
  const [dmUsername, setDmUsername] = useState("");
  const [groupName, setGroupName] = useState("");
  const [inviteUsername, setInviteUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { send, connected } = useChatSocket((conversationId, message) => {
    setMessagesByConversation((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] ?? []), message],
    }));
  });

  const refreshConversations = () => listConversations().then((res) => setConversations(res.conversations));
  const refreshInvites = () => listInvites().then((res) => setInvites(res.invites));

  useEffect(() => {
    if (!ready) return;
    refreshConversations();
    refreshInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Pick the world chat as the default active conversation once loaded.
  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      const world = conversations.find((c) => c.type === "world");
      setActiveId(world?.id ?? conversations[0].id);
    }
  }, [conversations, activeId]);

  useEffect(() => {
    if (!activeId || messagesByConversation[activeId]) return;
    getMessages(activeId)
      .then((res) => setMessagesByConversation((prev) => ({ ...prev, [activeId]: res.messages })))
      .catch(() => {});
  }, [activeId, messagesByConversation]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [activeId, messagesByConversation]);

  const activeConversation = useMemo(() => conversations.find((c) => c.id === activeId), [conversations, activeId]);
  const isGroupCreator = activeConversation?.type === "group"; // simplification: any group member can invite

  const onSend = () => {
    if (!activeId || !input.trim()) return;
    send(activeId, input.trim());
    setInput("");
  };

  const onStartDm = async () => {
    if (!dmUsername.trim()) return;
    setError(null);
    try {
      const { conversationId } = await startDirectConversation(dmUsername.trim());
      await refreshConversations();
      setActiveId(conversationId);
      setDmUsername("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memulai chat");
    }
  };

  const onCreateGroup = async () => {
    if (!groupName.trim()) return;
    setError(null);
    try {
      const { conversationId } = await createGroup(groupName.trim());
      await refreshConversations();
      setActiveId(conversationId);
      setGroupName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat grup");
    }
  };

  const onInvite = async () => {
    if (!activeId || !inviteUsername.trim()) return;
    setError(null);
    try {
      await inviteToGroup(activeId, inviteUsername.trim());
      setInviteUsername("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengundang");
    }
  };

  const onAcceptInvite = async (conversationId: string) => {
    try {
      await acceptInvite(conversationId);
      await refreshInvites();
      await refreshConversations();
      setActiveId(conversationId);
    } catch {
      // ignore
    }
  };

  if (!ready) return null;

  const activeMessages = activeId ? (messagesByConversation[activeId] ?? []) : [];

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <AppHeader />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Chat</h1>
        <span className={`text-xs ${connected ? "text-green-400" : "text-red-400"}`}>
          {connected ? "● terhubung" : "● terputus"}
        </span>
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {invites.length > 0 && (
        <div className="mb-4 rounded-lg border border-yellow-800 bg-yellow-950/20 p-3">
          <p className="mb-2 text-sm text-yellow-400">Undangan grup:</p>
          <div className="flex flex-wrap gap-2">
            {invites.map((inv) => (
              <button
                key={inv.conversationId}
                onClick={() => onAcceptInvite(inv.conversationId)}
                className="rounded-md border border-yellow-700 px-3 py-1.5 text-xs text-yellow-300 hover:bg-yellow-900/40"
              >
                Terima "{inv.groupName}"
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <aside className="flex flex-col gap-3">
          <div className="rounded-lg border border-gray-800 p-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Chat Baru</p>
            <div className="mb-2 flex gap-1">
              <input
                value={dmUsername}
                onChange={(e) => setDmUsername(e.target.value)}
                placeholder="username"
                className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200"
              />
              <button onClick={onStartDm} className="rounded-md border border-gray-700 px-2 py-1 text-xs hover:border-accent hover:text-accent">
                DM
              </button>
            </div>
            <div className="flex gap-1">
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="nama grup"
                className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200"
              />
              <button onClick={onCreateGroup} className="rounded-md border border-gray-700 px-2 py-1 text-xs hover:border-accent hover:text-accent">
                Buat
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1 rounded-lg border border-gray-800 p-2">
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`flex flex-col rounded-md px-3 py-2 text-left text-sm ${
                  activeId === c.id ? "bg-cyan-950/40 text-accent" : "text-gray-300 hover:bg-gray-900"
                }`}
              >
                <span>
                  {TYPE_ICON[c.type]} {c.name ?? "Chat"}
                </span>
                {c.lastMessage && (
                  <span className="truncate text-xs text-gray-500">
                    {c.lastMessage.senderUsername}: {c.lastMessage.body}
                  </span>
                )}
              </button>
            ))}
          </div>
        </aside>

        <section className="flex h-[32rem] flex-col rounded-lg border border-gray-800">
          <div className="flex items-center justify-between border-b border-gray-800 p-3">
            <span className="text-sm font-medium">
              {activeConversation ? `${TYPE_ICON[activeConversation.type]} ${activeConversation.name ?? "Chat"}` : "Pilih percakapan"}
            </span>
            {isGroupCreator && (
              <div className="flex gap-1">
                <input
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  placeholder="undang username"
                  className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200"
                />
                <button onClick={onInvite} className="rounded-md border border-gray-700 px-2 py-1 text-xs hover:border-accent hover:text-accent">
                  Invite
                </button>
              </div>
            )}
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
            <div className="flex flex-col gap-2">
              {activeMessages.map((m) => {
                const mine = m.senderUsername === user?.username;
                return (
                  <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    <span className="text-xs text-gray-500">{m.senderUsername}</span>
                    <span
                      className={`max-w-md rounded-lg px-3 py-1.5 text-sm ${
                        mine ? "bg-accent text-black" : "bg-gray-900 text-gray-200"
                      }`}
                    >
                      {m.body}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 border-t border-gray-800 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSend()}
              disabled={!activeId}
              placeholder="Ketik pesan..."
              className="flex-1 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 disabled:opacity-50"
            />
            <button
              onClick={onSend}
              disabled={!activeId || !input.trim()}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
            >
              Kirim
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
