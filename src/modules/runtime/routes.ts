import {
  ActionRequestStatus,
  AuditEventType,
  BindingStatus,
  LinkCodeStatus,
  type Prisma,
} from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { env } from "../../config/env.js";
import { issueRuntimeToken, requireRuntimeToken } from "../../lib/auth.js";
import { AppError } from "../../lib/app-error.js";
import { generateLinkCode, normalizeLinkCode } from "../../lib/link-code.js";
import { classifyRiskLevel, requiresApproval } from "../../lib/policy.js";
import { prisma } from "../../lib/prisma.js";
import { parseInput } from "../../lib/validation.js";

const runtimeContextSchema = z.object({
  runtimeName: z.string().trim().min(1),
  agentId: z.string().trim().min(1),
  sessionKey: z.string().trim().min(1),
  channelName: z.string().trim().min(1),
  channelUserRef: z.string().trim().min(1),
});

const createLinkCodeSchema = runtimeContextSchema.extend({
  expiresInSeconds: z.coerce.number().int().positive().max(3600).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const runtimeStatusSchema = z
  .object({
    code: z.string().trim().min(3).max(32).optional(),
    runtimeContext: runtimeContextSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.code && !value.runtimeContext) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide code or runtimeContext",
      });
    }

    if (value.code && value.runtimeContext) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide only one of code or runtimeContext",
      });
    }
  });

const executeRuntimeActionSchema = z.object({
  action: z.string().trim().min(1),
  args: z.record(z.string(), z.unknown()).default({}),
  runtimeContext: runtimeContextSchema,
});

function toJsonValue(value: Record<string, unknown>) {
  return value as Prisma.InputJsonValue;
}

function toOptionalJsonValue(value: Record<string, unknown> | undefined) {
  return value as Prisma.InputJsonValue | undefined;
}

async function createUniqueCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateLinkCode();
    const existing = await prisma.linkCode.findUnique({
      where: {
        code: candidate,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw new AppError(500, "Failed to allocate a unique link code");
}

export async function runtimeRoutes(app: FastifyInstance) {
  app.post("/runtime/link-codes", async (request, reply) => {
    const body = parseInput(createLinkCodeSchema, request.body);
    const code = await createUniqueCode();
    const expiresAt = new Date(
      Date.now() + (body.expiresInSeconds ?? env.LINK_CODE_TTL_SECONDS) * 1000,
    );

    const linkCode = await prisma.linkCode.create({
      data: {
        agentId: body.agentId,
        channelName: body.channelName,
        channelUserRef: body.channelUserRef,
        code,
        expiresAt,
        metadata: toOptionalJsonValue(body.metadata),
        runtimeName: body.runtimeName,
        sessionKey: body.sessionKey,
      },
    });

    await prisma.auditLog.create({
      data: {
        eventPayload: {
          agentId: body.agentId,
          channelName: body.channelName,
          channelUserRef: body.channelUserRef,
          code,
          runtimeName: body.runtimeName,
          sessionKey: body.sessionKey,
        } as Prisma.InputJsonValue,
        eventType: AuditEventType.LINK_CODE_CREATED,
      },
    });

    reply.code(201);

    return {
      data: {
        code: linkCode.code,
        expiresAt: linkCode.expiresAt,
        status: linkCode.status,
      },
    };
  });

  app.post("/runtime/status", async (request) => {
    const body = parseInput(runtimeStatusSchema, request.body);

    if (body.code) {
      const code = normalizeLinkCode(body.code);
      const linkCode = await prisma.linkCode.findUnique({
        where: {
          code,
        },
        include: {
          binding: true,
        },
      });

      if (!linkCode) {
        return {
          data: {
            linked: false,
            status: "not_found",
          },
        };
      }

      if (linkCode.status === LinkCodeStatus.PENDING && linkCode.expiresAt <= new Date()) {
        await prisma.linkCode.update({
          where: {
            id: linkCode.id,
          },
          data: {
            status: LinkCodeStatus.EXPIRED,
          },
        });

        await prisma.auditLog.create({
          data: {
            eventPayload: {
              code,
              runtimeName: linkCode.runtimeName,
            } as Prisma.InputJsonValue,
            eventType: AuditEventType.LINK_CODE_EXPIRED,
          },
        });

        return {
          data: {
            linked: false,
            status: "expired",
          },
        };
      }

      return {
        data: {
          bindingId: linkCode.bindingId,
          linked: linkCode.status === LinkCodeStatus.CLAIMED,
          runtimeToken:
            linkCode.status === LinkCodeStatus.CLAIMED && linkCode.binding
              ? await issueRuntimeToken({
                  agentId: linkCode.binding.agentId,
                  bindingId: linkCode.binding.id,
                  channelName: linkCode.binding.channelName,
                  channelUserRef: linkCode.binding.channelUserRef,
                  runtimeName: linkCode.binding.runtimeName,
                  sessionKey: linkCode.binding.sessionKey,
                  userId: linkCode.binding.userId,
                })
              : undefined,
          status: linkCode.status.toLowerCase(),
          userId: linkCode.claimedByUserId,
        },
      };
    }

    const runtimeContext = body.runtimeContext;

    if (!runtimeContext) {
      throw new AppError(400, "runtimeContext is required");
    }

    const runtimeToken = await requireRuntimeToken(request);

    const matchesRuntimeIdentity =
      runtimeToken.runtimeName === runtimeContext.runtimeName &&
      runtimeToken.agentId === runtimeContext.agentId &&
      runtimeToken.sessionKey === runtimeContext.sessionKey &&
      runtimeToken.channelName === runtimeContext.channelName &&
      runtimeToken.channelUserRef === runtimeContext.channelUserRef;

    if (!matchesRuntimeIdentity) {
      throw new AppError(403, "Runtime token does not match the provided runtime context");
    }

    const binding = await prisma.runtimeBinding.findUnique({
      where: {
        runtimeName_agentId_sessionKey_channelName_channelUserRef: runtimeContext,
      },
    });

    if (!binding) {
      return {
        data: {
          linked: false,
          status: "not_linked",
        },
      };
    }

    await prisma.runtimeBinding.update({
      where: {
        id: binding.id,
      },
      data: {
        lastSeenAt: new Date(),
      },
    });

    return {
      data: {
        bindingId: binding.id,
        linked: true,
        status: binding.status.toLowerCase(),
        userId: binding.userId,
      },
    };
  });

  app.post("/runtime/execute", async (request) => {
    const body = parseInput(executeRuntimeActionSchema, request.body);
    const runtimeToken = await requireRuntimeToken(request);

    const matchesRuntimeIdentity =
      runtimeToken.runtimeName === body.runtimeContext.runtimeName &&
      runtimeToken.agentId === body.runtimeContext.agentId &&
      runtimeToken.sessionKey === body.runtimeContext.sessionKey &&
      runtimeToken.channelName === body.runtimeContext.channelName &&
      runtimeToken.channelUserRef === body.runtimeContext.channelUserRef;

    if (!matchesRuntimeIdentity) {
      throw new AppError(403, "Runtime token does not match the provided runtime context");
    }

    const binding = await prisma.runtimeBinding.findUnique({
      where: {
        runtimeName_agentId_sessionKey_channelName_channelUserRef: body.runtimeContext,
      },
    });

    if (
      !binding ||
      binding.status !== BindingStatus.ACTIVE ||
      binding.id !== runtimeToken.bindingId
    ) {
      return {
        message: "This agent runtime is not linked to an authenticated Xentra user.",
        status: "not_linked",
      };
    }

    await prisma.runtimeBinding.update({
      where: {
        id: binding.id,
      },
      data: {
        lastSeenAt: new Date(),
      },
    });

    const riskLevel = classifyRiskLevel(body.action, body.args);

    const actionRequest = await prisma.actionRequest.create({
      data: {
        actionName: body.action,
        actionPayload: toJsonValue(body.args),
        bindingId: binding.id,
        riskLevel,
        userId: binding.userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        actionRequestId: actionRequest.id,
        bindingId: binding.id,
        eventPayload: {
          action: body.action,
          args: body.args,
          riskLevel,
        } as Prisma.InputJsonValue,
        eventType: AuditEventType.ACTION_REQUESTED,
        userId: binding.userId,
      },
    });

    if (requiresApproval(riskLevel)) {
      const approval = await prisma.approval.create({
        data: {
          actionRequestId: actionRequest.id,
        },
      });

      await prisma.actionRequest.update({
        where: {
          id: actionRequest.id,
        },
        data: {
          status: ActionRequestStatus.APPROVAL_REQUIRED,
        },
      });

      await prisma.auditLog.create({
        data: {
          actionRequestId: actionRequest.id,
          bindingId: binding.id,
          eventPayload: {
            action: body.action,
            approvalId: approval.id,
          } as Prisma.InputJsonValue,
          eventType: AuditEventType.APPROVAL_REQUESTED,
          userId: binding.userId,
        },
      });

      return {
        approvalId: approval.id,
        message: "Approve this action in Xentra before execution continues.",
        status: "approval_required",
      };
    }

    const resultSummary = "Execution adapter not attached yet. Request accepted and logged.";

    await prisma.actionRequest.update({
      where: {
        id: actionRequest.id,
      },
      data: {
        executedAt: new Date(),
        resultSummary,
        status: ActionRequestStatus.EXECUTED,
      },
    });

    await prisma.auditLog.create({
      data: {
        actionRequestId: actionRequest.id,
        bindingId: binding.id,
        eventPayload: {
          action: body.action,
          summary: resultSummary,
        } as Prisma.InputJsonValue,
        eventType: AuditEventType.ACTION_EXECUTED,
        userId: binding.userId,
      },
    });

    return {
      result: {
        summary: resultSummary,
      },
      status: "ok",
    };
  });
}
