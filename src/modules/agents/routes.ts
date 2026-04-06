import type { FastifyInstance } from "fastify";

import { requireUserToken } from "../../lib/auth.js";
import { prisma } from "../../lib/prisma.js";
import { syncUserFromToken } from "../../lib/user-context.js";

export async function agentRoutes(app: FastifyInstance) {
  app.get("/agents", async (request) => {
    const token = await requireUserToken(request);
    const user = await syncUserFromToken(prisma, token);

    const bindings = await prisma.runtimeBinding.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        linkedAt: "desc",
      },
    });

    return {
      data: bindings,
    };
  });
}
