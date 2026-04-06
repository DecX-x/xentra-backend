import {
  AuditEventType,
  BindingStatus,
  LinkCodeStatus,
  type Prisma,
} from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireUserToken } from "../../lib/auth.js";
import { AppError } from "../../lib/app-error.js";
import { normalizeLinkCode } from "../../lib/link-code.js";
import { prisma } from "../../lib/prisma.js";
import { syncUserFromToken } from "../../lib/user-context.js";
import { parseInput } from "../../lib/validation.js";

const redeemLinkCodeSchema = z.object({
  code: z.string().trim().min(3).max(32),
});

type RuntimeIdentity = Pick<
  Prisma.RuntimeBindingCreateInput,
  "agentId" | "channelName" | "channelUserRef" | "runtimeName" | "sessionKey"
>;

function toRuntimeIdentity(linkCode: {
  agentId: string;
  channelName: string;
  channelUserRef: string;
  runtimeName: string;
  sessionKey: string;
}): RuntimeIdentity {
  return {
    agentId: linkCode.agentId,
    channelName: linkCode.channelName,
    channelUserRef: linkCode.channelUserRef,
    runtimeName: linkCode.runtimeName,
    sessionKey: linkCode.sessionKey,
  };
}

export async function linkCodeRoutes(app: FastifyInstance) {
  app.post("/link-codes/redeem", async (request) => {
    const token = await requireUserToken(request);
    const user = await syncUserFromToken(prisma, token);
    const body = parseInput(redeemLinkCodeSchema, request.body);
    const code = normalizeLinkCode(body.code);

    const result = await prisma.$transaction(async (tx) => {
      const linkCode = await tx.linkCode.findUnique({
        where: {
          code,
        },
      });

      if (!linkCode) {
        throw new AppError(404, "Link code was not found");
      }

      if (linkCode.status === LinkCodeStatus.CLAIMED) {
        if (linkCode.claimedByUserId === user.id && linkCode.bindingId) {
          const binding = await tx.runtimeBinding.findUnique({
            where: {
              id: linkCode.bindingId,
            },
          });

          return {
            binding,
            status: "already_claimed" as const,
          };
        }

        throw new AppError(409, "Link code has already been claimed");
      }

      if (linkCode.expiresAt <= new Date()) {
        await tx.linkCode.update({
          where: {
            id: linkCode.id,
          },
          data: {
            status: LinkCodeStatus.EXPIRED,
          },
        });

        await tx.auditLog.create({
          data: {
            eventPayload: {
              code,
              runtimeName: linkCode.runtimeName,
            },
            eventType: AuditEventType.LINK_CODE_EXPIRED,
            userId: user.id,
          },
        });

        throw new AppError(410, "Link code has expired");
      }

      const runtimeIdentity = toRuntimeIdentity(linkCode);
      const existingBinding = await tx.runtimeBinding.findUnique({
        where: {
          runtimeName_agentId_sessionKey_channelName_channelUserRef: runtimeIdentity,
        },
      });

      if (existingBinding && existingBinding.userId !== user.id) {
        throw new AppError(
          409,
          "This runtime context is already linked to another Xentra user",
        );
      }

      const binding =
        existingBinding ??
        (await tx.runtimeBinding.create({
          data: {
            ...runtimeIdentity,
            linkedAt: new Date(),
            metadata: linkCode.metadata ?? undefined,
            status: BindingStatus.ACTIVE,
            userId: user.id,
          },
        }));

      if (existingBinding) {
        await tx.runtimeBinding.update({
          where: {
            id: existingBinding.id,
          },
          data: {
            lastSeenAt: new Date(),
            metadata: linkCode.metadata ?? existingBinding.metadata ?? undefined,
            status: BindingStatus.ACTIVE,
          },
        });
      }

      const claimedLinkCode = await tx.linkCode.update({
        where: {
          id: linkCode.id,
        },
        data: {
          bindingId: binding.id,
          claimedAt: new Date(),
          claimedByUserId: user.id,
          status: LinkCodeStatus.CLAIMED,
        },
      });

      await tx.auditLog.create({
        data: {
          bindingId: binding.id,
          eventPayload: {
            code: claimedLinkCode.code,
            runtimeName: binding.runtimeName,
          },
          eventType: AuditEventType.LINK_CODE_REDEEMED,
          userId: user.id,
        },
      });

      if (!existingBinding) {
        await tx.auditLog.create({
          data: {
            bindingId: binding.id,
            eventPayload: runtimeIdentity,
            eventType: AuditEventType.BINDING_CREATED,
            userId: user.id,
          },
        });
      }

      return {
        binding,
        status: "claimed" as const,
      };
    });

    return {
      data: result,
    };
  });
}
