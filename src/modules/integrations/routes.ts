import type { FastifyInstance } from "fastify";

import { requireUserToken } from "../../lib/auth.js";
import { prisma } from "../../lib/prisma.js";
import { syncUserFromToken } from "../../lib/user-context.js";

export async function integrationRoutes(app: FastifyInstance) {
  app.get("/integrations", async (request) => {
    const token = await requireUserToken(request, ["read:providers"]);
    const user = await syncUserFromToken(prisma, token);

    const integrations = await prisma.connectedAccount.findMany({
      where: {
        userId: user.id,
      },
      orderBy: [
        {
          status: "asc",
        },
        {
          provider: "asc",
        },
      ],
    });

    return {
      data: integrations,
    };
  });
}
