import {
  ApprovalStatus,
  BindingStatus,
  ConnectedAccountStatus,
} from "@prisma/client";
import type { FastifyInstance } from "fastify";

import { requireUserToken } from "../../lib/auth.js";
import { prisma } from "../../lib/prisma.js";
import { syncUserFromToken } from "../../lib/user-context.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard/summary", async (request) => {
    const token = await requireUserToken(request);
    const user = await syncUserFromToken(prisma, token);

    const [activeAgents, activeIntegrations, pendingApprovals, auditLogs] =
      await prisma.$transaction([
        prisma.runtimeBinding.count({
          where: {
            status: BindingStatus.ACTIVE,
            userId: user.id,
          },
        }),
        prisma.connectedAccount.count({
          where: {
            status: ConnectedAccountStatus.CONNECTED,
            userId: user.id,
          },
        }),
        prisma.approval.count({
          where: {
            actionRequest: {
              userId: user.id,
            },
            status: ApprovalStatus.PENDING,
          },
        }),
        prisma.auditLog.count({
          where: {
            userId: user.id,
          },
        }),
      ]);

    return {
      data: {
        activeAgents,
        activeIntegrations,
        pendingApprovals,
        auditLogs,
      },
    };
  });
}
