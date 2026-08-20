"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface OtherPlayer {
  userId: string;
  username: string;
  color: string;
  x: number;
  z: number;
}

interface SnapshotEvent {
  type: "snapshot";
  room: string;
  players: OtherPlayer[];
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

export const EMOTES = ["👋", "😂", "❤️", "😮"];

// Broadcasts this player's position to a named "room" (the /world hub by
// default, or an FPV room slug) and reflects everyone else's latest position
// in that same room back. Throttled client-side (not just a nice-to-have:
// the server rebroadcasts a full snapshot to everyone in the room on every
// update it receives, so sending every animation frame would flood it).
const SEND_INTERVAL_MS = 150;

// How long a chat bubble stays attached to a player before clearing, purely
// client-side timing since the server never persists chat messages.
const CHAT_BUBBLE_MS = 5000;
const EMOTE_MS = 1800;

export interface EmoteState {
  emoji: string;
  key: number;
}

export function usePresenceSocket(myUserId: string | undefined, room: string = "world") {
  const socketRef = useRef<WebSocket | null>(null);
  const [others, setOthers] = useState<OtherPlayer[]>([]);
  const [chatBubbles, setChatBubbles] = useState<Record<string, string>>({});
  const [emotes, setEmotes] = useState<Record<string, EmoteState>>({});
  const lastSentRef = useRef(0);
  const bubbleTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const emoteTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const emoteNonceRef = useRef(0);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";
    const token = typeof window !== "undefined" ? localStorage.getItem("cybersim_token") : null;
    if (!token) return;

    const socket = new WebSocket(
      `${wsUrl}/ws/world-presence?token=${encodeURIComponent(token)}&room=${encodeURIComponent(room)}`
    );
    socket.onmessage = (msg) => {
      let event: SnapshotEvent | ChatEvent | EmoteEvent;
      try {
        event = JSON.parse(msg.data);
      } catch {
        return;
      }
      if (event.type === "snapshot" && event.room === room) {
        setOthers(event.players.filter((p) => p.userId !== myUserId));
      } else if (event.type === "chat" && event.room === room && event.userId !== myUserId) {
        setChatBubbles((prev) => ({ ...prev, [event.userId]: event.text }));
        clearTimeout(bubbleTimersRef.current[event.userId]);
        bubbleTimersRef.current[event.userId] = setTimeout(() => {
          setChatBubbles((prev) => {
            const next = { ...prev };
            delete next[event.userId];
            return next;
          });
        }, CHAT_BUBBLE_MS);
      } else if (event.type === "emote" && event.room === room && event.userId !== myUserId) {
        emoteNonceRef.current += 1;
        const key = emoteNonceRef.current;
        setEmotes((prev) => ({ ...prev, [event.userId]: { emoji: event.emoji, key } }));
        clearTimeout(emoteTimersRef.current[event.userId]);
        emoteTimersRef.current[event.userId] = setTimeout(() => {
          setEmotes((prev) => {
            if (prev[event.userId]?.key !== key) return prev;
            const next = { ...prev };
            delete next[event.userId];
            return next;
          });
        }, EMOTE_MS);
      }
    };
    socketRef.current = socket;

    return () => socket.close();
  }, [myUserId, room]);

  const reportPosition = useCallback(
    (x: number, z: number) => {
      const now = performance.now();
      if (now - lastSentRef.current < SEND_INTERVAL_MS) return;
      lastSentRef.current = now;
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ x, z, room }));
      }
    },
    [room]
  );

  const sendChat = useCallback((text: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "chat", text }));
    }
  }, []);

  const sendEmote = useCallback((emoji: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "emote", emoji }));
    }
  }, []);

  return { others, reportPosition, chatBubbles, sendChat, emotes, sendEmote };
}
