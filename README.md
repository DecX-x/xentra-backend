# Xentra Backend

Backend scaffold in a separate codebase.

## Stack

- Fastify
- TypeScript
- Prisma
- PostgreSQL

## Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run db:push`
- `npm run prisma:validate`
- `npm run prisma:generate`

## Routes

- `GET /`
- `GET /health`
- `GET /health/ready`
- `GET /api/v1/dashboard/summary`
- `GET /api/v1/agents`
- `POST /api/v1/agents`
- `GET /api/v1/integrations`
- `POST /api/v1/integrations`
- `GET /api/v1/approvals`
- `POST /api/v1/approvals`
- `PATCH /api/v1/approvals/:id/review`
- `GET /api/v1/audit-logs`
- `POST /api/v1/audit-logs`
- `GET /api/v1/openclaw/health`
