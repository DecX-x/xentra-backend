import type { FastifyInstance } from "fastify";

import { prisma } from "../../lib/prisma.js";

export async function agentRoutes(app: FastifyInstance) {
  app.get("/agents", async () => {
    const agents = await prisma.agent.findMany({
      include: {
        bindings: {
          include: {
            integration: true,
          },
          orderBy: {
            linkedAt: "desc",
          },
        },
      },
      orderBy: {
        linkedAt: "desc",
      },
    });

    return {
      data: agents,
    };
  });
}
