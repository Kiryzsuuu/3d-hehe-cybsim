import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import rateLimit from "@fastify/rate-limit";
import authPlugin from "./plugins/auth.plugin.js";
import { authRoutes } from "./routes/auth.routes.js";
import { networkRoutes } from "./routes/network.routes.js";
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
await app.register(networkRoutes);
await app.register(terminalWebSocket);

app.get("/api/health", async () => ({ status: "ok" }));

const port = Number(process.env.PORT ?? 3001);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
