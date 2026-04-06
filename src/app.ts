import { Prisma } from "@prisma/client";
import Fastify from "fastify";
import { ZodError } from "zod";

import { AppError } from "./lib/app-error.js";
import { apiRoutes } from "./modules/index.js";
import { healthRoutes } from "./routes/health.js";

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.get("/", async () => {
    return {
      service: "xentra-backend",
      status: "ok",
    };
  });

  app.register(healthRoutes);
  app.register(apiRoutes, { prefix: "/api/v1" });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: "Not Found",
      message: `Route ${request.method} ${request.url} was not found`,
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      app.log.warn(
        {
          details: error.details,
          path: request.url,
          statusCode: error.statusCode,
        },
        error.message,
      );
      reply.code(error.statusCode).send({
        error: error.name,
        message: error.message,
        details: error.details,
      });
      return;
    }

    if (error instanceof ZodError) {
      reply.code(400).send({
        error: "ValidationError",
        message: "Request validation failed",
        details: error.flatten(),
      });
      return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        reply.code(409).send({
          error: "Conflict",
          message: "Resource already exists",
          details: error.meta,
        });
        return;
      }

      if (error.code === "P2025") {
        reply.code(404).send({
          error: "Not Found",
          message: "Requested resource was not found",
        });
        return;
      }
    }

    app.log.error(error);

    reply.code(500).send({
      error: "InternalServerError",
      message: "Unexpected server error",
    });
  });

  return app;
}
