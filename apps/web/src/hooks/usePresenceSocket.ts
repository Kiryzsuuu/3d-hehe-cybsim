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

// Broadcasts this player's position to a named "room" (the /world hub by
// default, or an FPV room slug) and reflects everyone else's latest position
// in that same room back. Throttled client-side (not just a nice-to-have:
// the server rebroadcasts a full snapshot to everyone in the room on every
// update it receives, so sending every animation frame would flood it).
const SEND_INTERVAL_MS = 150;

export function usePresenceSocket(myUserId: string | undefined, room: string = "world") {
  const socketRef = useRef<WebSocket | null>(null);
  const [others, setOthers] = useState<OtherPlayer[]>([]);
  const lastSentRef = useRef(0);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";
    const token = typeof window !== "undefined" ? localStorage.getItem("cybersim_token") : null;
    if (!token) return;

    const socket = new WebSocket(
      `${wsUrl}/ws/world-presence?token=${encodeURIComponent(token)}&room=${encodeURIComponent(room)}`
    );
    socket.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as SnapshotEvent;
        if (event.type === "snapshot" && event.room === room) {
          setOthers(event.players.filter((p) => p.userId !== myUserId));
        }
      } catch {
        // ignore malformed frames
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

  return { others, reportPosition };
}
