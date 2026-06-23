# Xentra Backend

The core backend service for the Xentra platform. Xentra is a system designed to orchestrate agent runtimes, track their actions, and enforce human-in-the-loop (HITL) approvals for potentially sensitive or high-risk actions. This repository contains the Fastify-based REST API, PostgreSQL database schema, and Prisma ORM configurations.

## Architecture & Domain Concepts

The backend acts as a central control plane for human users and automated agents (runtimes), with the following core entities:
- **Users:** Human users who authenticate via Auth0.
- **Runtime Bindings:** Links between a human user and an external agent runtime session.
- **Action Requests:** High-level tasks that an agent wants to perform on behalf of a user. These are evaluated for risk.
- **Approvals:** High-risk `ActionRequest`s require explicit human approval via the Xentra frontend.
- **Connected Accounts:** Third-party OAuth connections (e.g., Google, Slack, GitHub) linked to a user to allow agents to perform actions in those platforms.
- **Audit Logs:** Immutable records of system activities such as link code creation, approvals, and action executions.

## Tech Stack

- **Framework:** [Fastify](https://www.fastify.io/)
- **Language:** TypeScript
- **ORM:** [Prisma](https://www.prisma.io/)
- **Database:** PostgreSQL
- **Validation:** Zod
- **Auth:** Auth0 (human users) + JWT (runtime tokens)

## Prerequisites

- Node.js >= 20.0.0
- PostgreSQL database
- Docker (optional, for containerized deployments)

## Local Development Setup

1. **Clone the repository** and install dependencies:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Copy the example environment file and fill in the missing values.
   ```bash
   cp .env.example .env
   ```
   **Key Variables:**
   - `DATABASE_URL`: Connection string to your PostgreSQL instance.
   - `AUTH0_DOMAIN` & `AUTH0_AUDIENCE`: Your Auth0 tenant details for validating user tokens.
   - `XENTRA_RUNTIME_TOKEN_SECRET`: A long, random string (32+ chars) used to sign agent runtime JWTs.

3. **Database Setup**:
   Push the Prisma schema to your database to create the tables.
   ```bash
   npm run db:push
   ```
   Generate the Prisma client:
   ```bash
   npm run prisma:generate
   ```

4. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   The server will run with hot-reload enabled via `tsx`.

## Available Scripts

- `npm run dev`: Starts the development server in watch mode.
- `npm run build`: Compiles TypeScript source to the `dist` directory.
- `npm start`: Runs the compiled production code (`dist/server.js`).
- `npm run db:push`: Syncs the Prisma schema with the database (useful for prototyping; use migrations in production).
- `npm run prisma:generate`: Generates the Prisma client based on the schema.
- `npm run prisma:validate`: Validates the Prisma schema syntax.

## Runtime Auth Model (Agent Onboarding)

Unlike human users who use Auth0, agent runtimes use a specialized linking flow to obtain their credentials:

1. **Link Code Generation:** A runtime requests a short-lived link code by calling `POST /api/v1/runtime/link-codes`.
2. **Human Redemption:** The runtime presents this code to the human user (e.g., in a CLI or chat interface), who logs into the Xentra web app and redeems it.
3. **Status Polling:** Meanwhile, the runtime polls `POST /api/v1/runtime/status` with the link code.
4. **Token Issuance:** Once the human approves the code, the polling endpoint returns a `runtimeToken` (signed by Xentra).
5. **Authenticated Execution:** The runtime uses this token in the `Authorization: ****** header for subsequent calls, such as `POST /api/v1/runtime/execute`.

## Docker Deployment

You can run the application in a Docker container. A `Dockerfile` is included.

1. **Build the image**:
   ```bash
   docker build -t xentra-backend .
   ```

2. **Run the container**:
   Ensure you pass the `.env` file or environment variables.
   ```bash
   docker run --env-file .env -p 3001:3001 xentra-backend
   ```

*Note:* Before using the containerized app for the first time, ensure the database schema has been pushed or migrated.

## Project Structure

```text
├── prisma/
│   └── schema.prisma        # Database schema definitions
├── src/
│   ├── config/              # Environment and app configuration
│   ├── lib/                 # Core utilities (e.g., Auth, Prisma client)
│   ├── modules/             # Domain logic (Agents, Approvals, Dashboard, etc.)
│   ├── routes/              # Fastify route definitions (e.g., health check)
│   ├── app.ts               # Fastify app initialization and plugin registration
│   └── server.ts            # Entry point to start the server
├── Dockerfile               # Docker configuration
└── tsconfig.json            # TypeScript configuration
```

## API Routes Overview

### Core & Health
- `GET /`
- `GET /health`
- `GET /health/ready`

### Dashboard
- `GET /api/v1/dashboard/summary` - Aggregate metrics for the user dashboard.

### Agents & Integrations
- `GET /api/v1/agents` - List active agents.
- `GET /api/v1/integrations` - List connected third-party accounts.

### Human-in-the-Loop (Approvals)
- `GET /api/v1/approvals` - List pending action requests requiring approval.
- `POST /api/v1/approvals/:id/approve` - Approve an action.
- `POST /api/v1/approvals/:id/reject` - Reject an action.

### Runtime Link Flow & Execution
- `POST /api/v1/link-codes/redeem` - Redeem a link code (called by web frontend).
- `POST /api/v1/runtime/link-codes` - Generate a new link code (called by runtime).
- `POST /api/v1/runtime/status` - Check status of a link code (called by runtime).
- `POST /api/v1/runtime/execute` - Execute an action request (called by runtime).

### Audit
- `GET /api/v1/audit-logs` - Retrieve activity logs.

