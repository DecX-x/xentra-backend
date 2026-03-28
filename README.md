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

## Local Run

1. Copy `.env.example` to `.env`.
2. Fill `DATABASE_URL`, `AUTH0_DOMAIN`, and `AUTH0_AUDIENCE`.
3. Run `npm install`.
4. Run `npm run db:push`.
5. Run `npm run dev`.

## Docker

1. Build image: `docker build -t xentra-backend .`
2. Run container: `docker run --env-file .env -p 3001:3001 xentra-backend`
3. Push schema separately before first use with `npm run db:push` or your migration workflow.

## Routes

- `GET /`
- `GET /health`
- `GET /health/ready`
- `GET /api/v1/dashboard/summary`
- `GET /api/v1/agents`
- `GET /api/v1/integrations`
- `GET /api/v1/approvals`
- `POST /api/v1/approvals/:id/approve`
- `POST /api/v1/approvals/:id/reject`
- `GET /api/v1/audit-logs`
- `POST /api/v1/link-codes/redeem`
- `POST /api/v1/runtime/link-codes`
- `POST /api/v1/runtime/status`
- `POST /api/v1/runtime/execute`
