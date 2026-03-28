import type { FastifyInstance } from "fastify";

import { prisma } from "../../lib/prisma.js";

export async function integrationRoutes(app: FastifyInstance) {
  app.get("/integrations", async () => {
    const integrations = await prisma.integration.findMany({
      include: {
        _count: {
          select: {
            bindings: true,
          },
        },
      },
      orderBy: [
        {
          state: "asc",
        },
        {
          name: "asc",
        },
      ],
    });

    return {
      data: integrations,
    };
  });
}
