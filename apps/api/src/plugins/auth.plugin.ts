import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

export default fp(async function authPlugin(app: FastifyInstance) {
  app.decorate("authenticate", async (req: any, reply: any) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.status(401).send({ error: "Unauthorized" });
    }
  });
});
