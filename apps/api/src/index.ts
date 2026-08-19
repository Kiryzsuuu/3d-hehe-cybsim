import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import rateLimit from "@fastify/rate-limit";
import authPlugin from "./plugins/auth.plugin.js";
import { authRoutes } from "./routes/auth.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { chatRoutes } from "./routes/chat.routes.js";
import { networkRoutes } from "./routes/network.routes.js";
import { profileRoutes } from "./routes/profile.routes.js";
import { roomRoutes } from "./routes/room.routes.js";
import { sandboxRoutes } from "./routes/sandbox.routes.js";
import { scenarioRoutes } from "./routes/scenario.routes.js";
import { chatWebSocket } from "./websocket/chat.ws.js";
import { roomWebSocket } from "./websocket/room.ws.js";
import { terminalWebSocket } from "./websocket/terminal.ws.js";

const app = Fastify({ logger: true });

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be set and at least 32 characters long");
}

await app.register(cors, {
  origin: process.env.NEXT_PUBLIC_API_URL ? true : "http://localhost:3000",
});
await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
await app.register(jwt, { secret: JWT_SECRET });
await app.register(websocket);
await app.register(authPlugin);

await app.register(authRoutes);
await app.register(adminRoutes);
await app.register(chatRoutes);
await app.register(networkRoutes);
await app.register(profileRoutes);
await app.register(roomRoutes);
await app.register(sandboxRoutes);
await app.register(scenarioRoutes);
await app.register(chatWebSocket);
await app.register(roomWebSocket);
await app.register(terminalWebSocket);

app.get("/api/health", async () => ({ status: "ok" }));

const port = Number(process.env.PORT ?? 3001);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
