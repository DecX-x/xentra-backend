import Fastify from "fastify";

import { apiRoutes } from "./modules/index.js";
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
  app.register(apiRoutes, { prefix: "/api/v1" });

  return app;
}
