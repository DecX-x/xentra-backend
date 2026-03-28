import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { parseInput } from "../../lib/validation.js";
import { prisma } from "../../lib/prisma.js";

const createAuditLogSchema = z.object({
  agentId: z.string().uuid().optional(),
  integrationId: z.string().uuid().optional(),
  approvalRequestId: z.string().uuid().optional(),
  action: z.string().min(1),
  actorLabel: z.string().min(1).optional(),
  destination: z.string().min(1).optional(),
  checksum: z.string().min(1).optional(),
  payloadSummary: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  severity: z.enum(["INFO", "WARNING", "HIGH", "IMMUTABLE_RECORD"]).default("INFO"),
  subject: z.string().min(1).optional(),
  trustScore: z.number().int().min(0).max(100).optional(),
  recordedAt: z.string().datetime().optional(),
});

export async function auditLogRoutes(app: FastifyInstance) {
  app.get("/audit-logs", async () => {
    const auditLogs = await prisma.auditLog.findMany({
      include: {
        agent: true,
        approvalRequest: true,
        integration: true,
      },
      orderBy: {
        recordedAt: "desc",
      },
      take: 50,
    });

    return {
      data: auditLogs,
    };
  });

  app.post("/audit-logs", async (request, reply) => {
    const body = parseInput(createAuditLogSchema, request.body);

    const auditLog = await prisma.auditLog.create({
      data: {
        ...body,
        recordedAt: body.recordedAt ? new Date(body.recordedAt) : undefined,
      },
    });

    reply.code(201);

    return {
      data: auditLog,
    };
  });
}
