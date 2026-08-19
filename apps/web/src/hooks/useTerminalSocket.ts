"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TerminalCommandInput, TerminalOutputEvent } from "@cybersim/types";

export function useTerminalSocket(onEvent: (event: TerminalOutputEvent) => void) {
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";
    const token = typeof window !== "undefined" ? localStorage.getItem("cybersim_token") : null;
    if (!token) return;

    const socket = new WebSocket(`${wsUrl}/ws/terminal?token=${encodeURIComponent(token)}`);
    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onmessage = (msg) => {
      try {
        onEventRef.current(JSON.parse(msg.data) as TerminalOutputEvent);
      } catch {
        // ignore malformed frames
      }
    };
    socketRef.current = socket;

    return () => socket.close();
  }, []);

  const send = useCallback((payload: TerminalCommandInput) => {
    socketRef.current?.readyState === WebSocket.OPEN &&
      socketRef.current.send(JSON.stringify({ type: "command", payload }));
  }, []);

  return { send, connected };
}
