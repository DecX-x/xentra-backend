import type { PrismaClient } from "@prisma/client";

import type { AccessTokenClaims } from "./auth.js";

export async function syncUserFromToken(
  prisma: PrismaClient,
  payload: AccessTokenClaims,
) {
  return prisma.user.upsert({
    where: {
      auth0UserId: payload.sub,
    },
    create: {
      auth0UserId: payload.sub,
      email: payload.email,
      name: payload.name,
    },
    update: {
      email: payload.email,
      name: payload.name,
    },
  });
}
