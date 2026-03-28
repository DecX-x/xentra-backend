import type { FastifyInstance } from "fastify";

import { agentRoutes } from "./agents/routes.js";
import { approvalRoutes } from "./approvals/routes.js";
import { auditLogRoutes } from "./audit-logs/routes.js";
import { dashboardRoutes } from "./dashboard/routes.js";
import { integrationRoutes } from "./integrations/routes.js";

export async function apiRoutes(app: FastifyInstance) {
  app.register(dashboardRoutes);
  app.register(agentRoutes);
  app.register(integrationRoutes);
  app.register(approvalRoutes);
  app.register(auditLogRoutes);
}
