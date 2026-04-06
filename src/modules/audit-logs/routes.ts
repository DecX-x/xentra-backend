import type { FastifyInstance } from "fastify";

import { requireUserToken } from "../../lib/auth.js";
import { prisma } from "../../lib/prisma.js";
import { syncUserFromToken } from "../../lib/user-context.js";

export async function auditLogRoutes(app: FastifyInstance) {
  app.get("/audit-logs", async (request) => {
    const token = await requireUserToken(request);
    const user = await syncUserFromToken(prisma, token);

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        userId: user.id,
      },
      include: {
        actionRequest: true,
        binding: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    return {
      data: auditLogs,
    };
  });
}
