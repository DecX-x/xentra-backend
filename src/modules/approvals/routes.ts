import {
  ActionRequestStatus,
  ApprovalStatus,
  AuditEventType,
} from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireUserToken } from "../../lib/auth.js";
import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import { syncUserFromToken } from "../../lib/user-context.js";
import { parseInput } from "../../lib/validation.js";

const approvalParamsSchema = z.object({
  id: z.string().uuid(),
});

const rejectApprovalSchema = z.object({
  rejectionReason: z.string().trim().min(1).max(500).optional(),
});

export async function approvalRoutes(app: FastifyInstance) {
  app.get("/approvals", async (request) => {
    const token = await requireUserToken(request, ["read:approvals"]);
    const user = await syncUserFromToken(prisma, token);

    const approvals = await prisma.approval.findMany({
      where: {
        actionRequest: {
          userId: user.id,
        },
      },
      include: {
        actionRequest: {
          include: {
            binding: true,
          },
        },
        approvedByUser: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      data: approvals,
    };
  });

  app.post("/approvals/:id/approve", async (request) => {
    const token = await requireUserToken(request, ["write:approvals"]);
    const user = await syncUserFromToken(prisma, token);
    const params = parseInput(approvalParamsSchema, request.params);

    const approval = await prisma.approval.findFirst({
      where: {
        actionRequest: {
          userId: user.id,
        },
        id: params.id,
      },
      include: {
        actionRequest: true,
      },
    });

    if (!approval) {
      throw new AppError(404, "Approval not found");
    }

    const updatedApproval = await prisma.$transaction(async (tx) => {
      const nextApproval = await tx.approval.update({
        where: {
          id: approval.id,
        },
        data: {
          approvedAt: new Date(),
          approvedByUserId: user.id,
          rejectionReason: null,
          rejectedAt: null,
          status: ApprovalStatus.APPROVED,
        },
      });

      await tx.actionRequest.update({
        where: {
          id: approval.actionRequestId,
        },
        data: {
          status: ActionRequestStatus.APPROVED,
        },
      });

      await tx.auditLog.create({
        data: {
          actionRequestId: approval.actionRequestId,
          bindingId: approval.actionRequest.bindingId,
          eventPayload: {
            approvalId: approval.id,
          },
          eventType: AuditEventType.APPROVAL_GRANTED,
          userId: user.id,
        },
      });

      return nextApproval;
    });

    return {
      data: updatedApproval,
    };
  });

  app.post("/approvals/:id/reject", async (request) => {
    const token = await requireUserToken(request, ["write:approvals"]);
    const user = await syncUserFromToken(prisma, token);
    const params = parseInput(approvalParamsSchema, request.params);
    const body = parseInput(rejectApprovalSchema, request.body);

    const approval = await prisma.approval.findFirst({
      where: {
        actionRequest: {
          userId: user.id,
        },
        id: params.id,
      },
      include: {
        actionRequest: true,
      },
    });

    if (!approval) {
      throw new AppError(404, "Approval not found");
    }

    const updatedApproval = await prisma.$transaction(async (tx) => {
      const nextApproval = await tx.approval.update({
        where: {
          id: approval.id,
        },
        data: {
          approvedAt: null,
          approvedByUserId: user.id,
          rejectedAt: new Date(),
          rejectionReason: body.rejectionReason,
          status: ApprovalStatus.REJECTED,
        },
      });

      await tx.actionRequest.update({
        where: {
          id: approval.actionRequestId,
        },
        data: {
          status: ActionRequestStatus.REJECTED,
        },
      });

      await tx.auditLog.create({
        data: {
          actionRequestId: approval.actionRequestId,
          bindingId: approval.actionRequest.bindingId,
          eventPayload: {
            approvalId: approval.id,
            rejectionReason: body.rejectionReason,
          },
          eventType: AuditEventType.APPROVAL_REJECTED,
          userId: user.id,
        },
      });

      return nextApproval;
    });

    return {
      data: updatedApproval,
    };
  });
}
