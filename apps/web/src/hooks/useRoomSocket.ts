"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomState } from "@/lib/api";

interface RoomEvent {
  type: "state" | "error";
  state?: RoomState;
  body?: string;
}

export function useRoomSocket(code: string, onState: (state: RoomState) => void) {
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onStateRef = useRef(onState);
  onStateRef.current = onState;

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";
    const token = typeof window !== "undefined" ? localStorage.getItem("cybersim_token") : null;
    if (!token || !code) return;

    const socket = new WebSocket(`${wsUrl}/ws/room?token=${encodeURIComponent(token)}&code=${code}`);
    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as RoomEvent;
        if (event.type === "state" && event.state) onStateRef.current(event.state);
        if (event.type === "error" && event.body) setError(event.body);
      } catch {
        // ignore malformed frames
      }
    };
    socketRef.current = socket;

    return () => socket.close();
  }, [code]);

  const claim = useCallback((objectiveId: string) => {
    socketRef.current?.readyState === WebSocket.OPEN &&
      socketRef.current.send(JSON.stringify({ action: "claim", objectiveId }));
  }, []);

  const complete = useCallback((objectiveId: string) => {
    socketRef.current?.readyState === WebSocket.OPEN &&
      socketRef.current.send(JSON.stringify({ action: "complete", objectiveId }));
  }, []);

  return { connected, error, claim, complete };
}
