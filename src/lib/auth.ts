import type { FastifyRequest } from "fastify";
import {
  errors,
  createRemoteJWKSet,
  jwtVerify,
  SignJWT,
  type JWTPayload,
} from "jose";

import { env } from "../config/env.js";
import { AppError } from "./app-error.js";

const issuer = `https://${env.AUTH0_DOMAIN}/`;
const jwks = createRemoteJWKSet(new URL(".well-known/jwks.json", issuer));
const runtimeTokenIssuer = "xentra-runtime";
const runtimeTokenAudience = "xentra-runtime-api";
const runtimeSecret = new TextEncoder().encode(env.XENTRA_RUNTIME_TOKEN_SECRET);

export type AccessTokenClaims = JWTPayload & {
  email?: string;
  gty?: string;
  name?: string;
  permissions?: string[];
  scope?: string;
  sub: string;
};

export type RuntimeTokenClaims = JWTPayload & {
  agentId: string;
  bindingId: string;
  channelName: string;
  channelUserRef: string;
  runtimeName: string;
  sessionKey: string;
  typ: "xentra-runtime";
  userId: string;
};

function getBearerToken(request: FastifyRequest) {
  const authorization = request.headers.authorization;

  if (!authorization) {
    throw new AppError(401, "Authorization header is required");
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AppError(401, "Authorization header must use Bearer token format");
  }

  return token;
}

function getGrantedScopes(payload: AccessTokenClaims) {
  const scopes = new Set<string>();

  for (const scope of payload.scope?.split(" ") ?? []) {
    if (scope) {
      scopes.add(scope);
    }
  }

  for (const permission of payload.permissions ?? []) {
    if (permission) {
      scopes.add(permission);
    }
  }

  return scopes;
}

async function verifyAccessToken(request: FastifyRequest) {
  const token = getBearerToken(request);

  try {
    const { payload } = await jwtVerify(token, jwks, {
      audience: env.AUTH0_AUDIENCE,
      issuer,
    });

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new AppError(401, "Access token is missing a valid subject claim");
    }

    return payload as AccessTokenClaims;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof errors.JOSEError) {
      throw new AppError(401, "Access token validation failed");
    }

    throw error;
  }
}

function assertScopes(
  payload: AccessTokenClaims,
  requiredScopes: string[],
  message: string,
) {
  if (requiredScopes.length === 0) {
    return;
  }

  const grantedScopes = getGrantedScopes(payload);
  const missingScopes = requiredScopes.filter((scope) => !grantedScopes.has(scope));

  if (missingScopes.length > 0) {
    throw new AppError(403, message, {
      missingScopes,
    });
  }
}

export async function requireUserToken(
  request: FastifyRequest,
  requiredScopes: string[] = [],
) {
  const payload = await verifyAccessToken(request);

  if (payload.gty === "client-credentials") {
    throw new AppError(403, "User access token is required");
  }

  assertScopes(payload, requiredScopes, "Token is missing required user scopes");

  return payload;
}

export async function requireServiceToken(
  request: FastifyRequest,
  requiredScopeSets: string[][],
) {
  const payload = await verifyAccessToken(request);

  if (payload.gty !== "client-credentials") {
    throw new AppError(403, "Service access token is required");
  }

  const grantedScopes = getGrantedScopes(payload);
  const matchesAtLeastOneSet = requiredScopeSets.some((scopeSet) =>
    scopeSet.every((scope) => grantedScopes.has(scope)),
  );

  if (!matchesAtLeastOneSet) {
    throw new AppError(403, "Token is missing required service scopes", {
      requiredScopeSets,
    });
  }

  return payload;
}

export async function issueRuntimeToken(claims: {
  agentId: string;
  bindingId: string;
  channelName: string;
  channelUserRef: string;
  runtimeName: string;
  sessionKey: string;
  userId: string;
}) {
  return new SignJWT({
    agentId: claims.agentId,
    bindingId: claims.bindingId,
    channelName: claims.channelName,
    channelUserRef: claims.channelUserRef,
    runtimeName: claims.runtimeName,
    sessionKey: claims.sessionKey,
    typ: "xentra-runtime",
    userId: claims.userId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(`runtime:${claims.bindingId}`)
    .setIssuer(runtimeTokenIssuer)
    .setAudience(runtimeTokenAudience)
    .setIssuedAt()
    .setExpirationTime(`${env.XENTRA_RUNTIME_TOKEN_TTL_SECONDS}s`)
    .sign(runtimeSecret);
}

export async function requireRuntimeToken(request: FastifyRequest) {
  const token = getBearerToken(request);

  try {
    const { payload } = await jwtVerify(token, runtimeSecret, {
      audience: runtimeTokenAudience,
      issuer: runtimeTokenIssuer,
    });

    const requiredStringClaims = [
      "bindingId",
      "userId",
      "runtimeName",
      "agentId",
      "sessionKey",
      "channelName",
      "channelUserRef",
    ] as const;

    for (const claim of requiredStringClaims) {
      if (typeof payload[claim] !== "string" || payload[claim].length === 0) {
        throw new AppError(401, `Runtime token is missing claim: ${claim}`);
      }
    }

    if (payload.typ !== "xentra-runtime") {
      throw new AppError(401, "Runtime token type is invalid");
    }

    return payload as RuntimeTokenClaims;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof errors.JOSEError) {
      throw new AppError(401, "Runtime token validation failed");
    }

    throw error;
  }
}
