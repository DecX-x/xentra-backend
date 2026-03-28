import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { parseInput } from "../../lib/validation.js";
import { prisma } from "../../lib/prisma.js";

const createApprovalSchema = z.object({
  agentId: z.string().uuid(),
  requesterId: z.string().uuid().optional(),
  title: z.string().min(1),
  action: z.string().min(1),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  recipient: z.string().email().optional(),
  subject: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  transactionHash: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
});

const reviewApprovalParamsSchema = z.object({
  id: z.string().uuid(),
});

const reviewApprovalSchema = z.object({
  reviewerId: z.string().uuid().optional(),
  status: z.enum(["APPROVED", "REJECTED"]),
  decisionNote: z.string().min(1).optional(),
});

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

  app.post("/approvals", async (request, reply) => {
    const body = parseInput(createApprovalSchema, request.body);

    const approval = await prisma.approvalRequest.create({
      data: {
        ...body,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      },
    });

    reply.code(201);

    return {
      data: approval,
    };
  });

  app.patch("/approvals/:id/review", async (request) => {
    const params = parseInput(reviewApprovalParamsSchema, request.params);
    const body = parseInput(reviewApprovalSchema, request.body);

    const approval = await prisma.approvalRequest.update({
      where: {
        id: params.id,
      },
      data: {
        reviewerId: body.reviewerId,
        status: body.status,
        decisionNote: body.decisionNote,
        reviewedAt: new Date(),
      },
    });

    return {
      data: approval,
    };
  });
}
