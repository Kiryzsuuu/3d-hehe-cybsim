import type { FastifyInstance } from "fastify";
import { parseAndRun } from "@cybersim/cli-parser";
import type { TerminalOutputEvent, JwtPayload } from "@cybersim/types";
import { createWsRateLimiter } from "./wsRateLimit.js";

export async function terminalWebSocket(app: FastifyInstance) {
  // @fastify/websocket v9+ passes the raw ws WebSocket as the first argument
  // (earlier versions wrapped it as `{ socket }`).
  app.get("/ws/terminal", { websocket: true }, (socket, req) => {
    const token = (req.query as { token?: string })?.token;
    let payload: JwtPayload;
    try {
      if (!token) throw new Error("missing token");
      payload = app.jwt.verify(token);
    } catch {
      socket.send(JSON.stringify({ type: "error", data: "Unauthorized" } satisfies TerminalOutputEvent));
      socket.close();
      return;
    }
    const username = payload.username;

    const send = (event: TerminalOutputEvent) => socket.send(JSON.stringify(event));
    const allowCommand = createWsRateLimiter(15, 5000);

    send({ type: "output", data: `Welcome, ${username}. Type "help" to get started.` });

    socket.on("message", (raw: Buffer) => {
      let message: unknown;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return send({ type: "error", data: "Malformed message" });
      }

      if (!allowCommand()) {
        return send({ type: "error", data: "Too many commands, slow down" });
      }

      const payload = (message as { payload?: unknown })?.payload;
      try {
        const output = parseAndRun(payload, { username });
        send({ type: "output", data: output });
      } catch (err) {
        send({ type: "error", data: err instanceof Error ? err.message : "Command failed" });
      }
    });
  });
}
