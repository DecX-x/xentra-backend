import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { parseInput } from "../../lib/validation.js";
import { prisma } from "../../lib/prisma.js";

const createAgentSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  channel: z.enum(["OPENCLAW_API", "CLI_SSH", "WEBSOCKET_BRIDGE", "TERMINAL"]),
  status: z.enum(["ACTIVE", "INACTIVE", "REVOKED"]).default("ACTIVE"),
  trustScore: z.number().int().min(0).max(100).optional(),
});

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

  app.post("/agents", async (request, reply) => {
    const body = parseInput(createAgentSchema, request.body);

    const agent = await prisma.agent.create({
      data: body,
    });

    reply.code(201);

    return {
      data: agent,
    };
  });
}
