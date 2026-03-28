import type { FastifyInstance } from "fastify";

import { prisma } from "../../lib/prisma.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard/summary", async () => {
    const [agents, integrations, pendingApprovals, auditLogs] =
      await prisma.$transaction([
        prisma.agent.count({
          where: {
            status: "ACTIVE",
          },
        }),
        prisma.integration.count({
          where: {
            state: "ACTIVE",
          },
        }),
        prisma.approvalRequest.count({
          where: {
            status: "PENDING",
          },
        }),
        prisma.auditLog.count(),
      ]);

    return {
      data: {
        activeAgents: agents,
        activeIntegrations: integrations,
        pendingApprovals,
        auditLogs,
      },
    };
  });
}
