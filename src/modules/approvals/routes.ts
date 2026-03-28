import type { FastifyInstance } from "fastify";

import { prisma } from "../../lib/prisma.js";

export async function approvalRoutes(app: FastifyInstance) {
  app.get("/approvals", async () => {
    const approvals = await prisma.approvalRequest.findMany({
      include: {
        agent: true,
        reviewer: true,
        requester: true,
      },
      orderBy: {
        requestedAt: "desc",
      },
    });

    return {
      data: approvals,
    };
  });
}
