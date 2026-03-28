import type { FastifyInstance } from "fastify";

import { prisma } from "../lib/prisma.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return {
      service: "xentra-backend",
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/health/ready", async (_request, reply) => {
    try {
      await prisma.$queryRawUnsafe("SELECT 1");

      return {
        service: "xentra-backend",
        status: "ready",
        database: "up",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      reply.code(503);

      return {
        service: "xentra-backend",
        status: "degraded",
        database: "down",
        message:
          error instanceof Error ? error.message : "Database connection failed",
        timestamp: new Date().toISOString(),
      };
    }
  });
}
