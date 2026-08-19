"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/api";

interface IncomingEvent {
  type: "message" | "error";
  conversationId?: string;
  id?: string;
  body?: string;
  senderUsername?: string;
  createdAt?: string;
}

export function useChatSocket(onMessage: (conversationId: string, message: ChatMessage) => void) {
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";
    const token = typeof window !== "undefined" ? localStorage.getItem("cybersim_token") : null;
    if (!token) return;

    const socket = new WebSocket(`${wsUrl}/ws/chat?token=${encodeURIComponent(token)}`);
    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as IncomingEvent;
        if (event.type === "message" && event.conversationId && event.id && event.body && event.senderUsername) {
          onMessageRef.current(event.conversationId, {
            id: event.id,
            body: event.body,
            senderUsername: event.senderUsername,
            createdAt: event.createdAt ?? new Date().toISOString(),
          });
        }
      } catch {
        // ignore malformed frames
      }
    };
    socketRef.current = socket;

    return () => socket.close();
  }, []);

  const send = useCallback((conversationId: string, body: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ conversationId, body }));
    }
  }, []);

  return { send, connected };
}
