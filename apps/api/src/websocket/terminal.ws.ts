import type { FastifyInstance } from "fastify";
import { parseAndRun } from "@cybersim/cli-parser";
import type { TerminalOutputEvent, JwtPayload } from "@cybersim/types";

export async function terminalWebSocket(app: FastifyInstance) {
  app.get("/ws/terminal", { websocket: true }, (connection, req) => {
    const token = (req.query as { token?: string })?.token;
    let payload: JwtPayload;
    try {
      if (!token) throw new Error("missing token");
      payload = app.jwt.verify(token);
    } catch {
      connection.socket.send(JSON.stringify({ type: "error", data: "Unauthorized" } satisfies TerminalOutputEvent));
      connection.socket.close();
      return;
    }
    const username = payload.username;

    const send = (event: TerminalOutputEvent) => connection.socket.send(JSON.stringify(event));

    send({ type: "output", data: `Welcome, ${username}. Type "help" to get started.` });

    connection.socket.on("message", (raw: Buffer) => {
      let message: unknown;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return send({ type: "error", data: "Malformed message" });
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
