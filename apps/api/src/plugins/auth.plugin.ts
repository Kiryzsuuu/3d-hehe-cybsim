import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { JwtPayload } from "@cybersim/types";

export default fp(async function authPlugin(app: FastifyInstance) {
  app.decorate("authenticate", async (req: any, reply: any) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.status(401).send({ error: "Unauthorized" });
    }
  });

  // Trusts the role claim baked into the JWT at login/register time rather
  // than re-checking the DB on every request. Tradeoff: demoting an admin
  // doesn't take effect until their token expires (JWT_EXPIRES_IN). Must run
  // after `authenticate` so req.user is populated.
  app.decorate("requireAdmin", async (req: any, reply: any) => {
    const user = req.user as JwtPayload | undefined;
    if (user?.role !== "admin") {
      reply.status(403).send({ error: "Admin access required" });
    }
  });
});
