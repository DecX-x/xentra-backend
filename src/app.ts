import Fastify from "fastify";

import { healthRoutes } from "./routes/health.js";

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.get("/", async () => {
    return {
      service: "xentra-backend",
      status: "ok",
    };
  });

  app.register(healthRoutes);

  return app;
}
