import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { parseInput } from "../../lib/validation.js";
import { prisma } from "../../lib/prisma.js";

const createIntegrationSchema = z.object({
  provider: z.enum(["GOOGLE_WORKSPACE", "SLACK", "GITHUB", "CUSTOM"]),
  name: z.string().min(1),
  state: z.enum(["ACTIVE", "INACTIVE", "REQUESTED"]).default("INACTIVE"),
  accountEmail: z.string().email().optional(),
  scopes: z.array(z.string().min(1)).default([]),
});

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

  app.post("/integrations", async (request, reply) => {
    const body = parseInput(createIntegrationSchema, request.body);

    const integration = await prisma.integration.create({
      data: body,
    });

    reply.code(201);

    return {
      data: integration,
    };
  });
}
