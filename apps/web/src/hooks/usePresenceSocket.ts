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
  players: OtherPlayer[];
}

// Broadcasts this player's position to the shared "world" room and reflects
// everyone else's latest position back. Throttled client-side (not just a
// nice-to-have: the server rebroadcasts a full snapshot to everyone on every
// update it receives, so sending every animation frame would flood it).
const SEND_INTERVAL_MS = 150;

export function usePresenceSocket(myUserId: string | undefined) {
  const socketRef = useRef<WebSocket | null>(null);
  const [others, setOthers] = useState<OtherPlayer[]>([]);
  const lastSentRef = useRef(0);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";
    const token = typeof window !== "undefined" ? localStorage.getItem("cybersim_token") : null;
    if (!token) return;

    const socket = new WebSocket(`${wsUrl}/ws/world-presence?token=${encodeURIComponent(token)}`);
    socket.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as SnapshotEvent;
        if (event.type === "snapshot") {
          setOthers(event.players.filter((p) => p.userId !== myUserId));
        }
      } catch {
        // ignore malformed frames
      }
    };
    socketRef.current = socket;

    return () => socket.close();
  }, [myUserId]);

  const reportPosition = useCallback((x: number, z: number) => {
    const now = performance.now();
    if (now - lastSentRef.current < SEND_INTERVAL_MS) return;
    lastSentRef.current = now;
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ x, z }));
    }
  }, []);

  return { others, reportPosition };
}
