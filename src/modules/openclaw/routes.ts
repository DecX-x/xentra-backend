import type { FastifyInstance } from "fastify";

import { openClawService } from "../../services/openclaw.js";

export async function openClawRoutes(app: FastifyInstance) {
  app.get("/openclaw/health", async () => {
    return {
      data: await openClawService.health(),
    };
  });
}
