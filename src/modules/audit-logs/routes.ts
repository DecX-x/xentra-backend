import type { FastifyInstance } from "fastify";

import { prisma } from "../../lib/prisma.js";

export async function auditLogRoutes(app: FastifyInstance) {
  app.get("/audit-logs", async () => {
    const auditLogs = await prisma.auditLog.findMany({
      include: {
        agent: true,
        approvalRequest: true,
        integration: true,
      },
      orderBy: {
        recordedAt: "desc",
      },
      take: 50,
    });

    return {
      data: auditLogs,
    };
  });
}
