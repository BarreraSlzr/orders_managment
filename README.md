---
name: Vercel Postgres + Kysely Next.js Starter
slug: postgres-kysely
description: Simple Next.js template that uses Vercel Postgres as the database and Kysely as the query builder.
framework: Next.js
useCase: Starter
css: Tailwind
database: Vercel Postgres
deployUrl: https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Fexamples%2Ftree%2Fmain%2Fstorage%2Fpostgres-kysely&project-name=postgres-kysely&repository-name=postgres-kysely&demo-title=Vercel%20Postgres%20%2B%20Kysely%20Next.js%20Starter&demo-description=Simple%20Next.js%20template%20that%20uses%20Vercel%20Postgres%20as%20the%20database%20and%20Kysely%20as%20the%20ORM.&demo-url=https%3A%2F%2Fpostgres-kysely.vercel.app%2F&demo-image=https%3A%2F%2Fpostgres-kysely.vercel.app%2Fopengraph-image.png&stores=%5B%7B"type"%3A"postgres"%7D%5D
demoUrl: https://postgres-kysely.vercel.app/
relatedTemplates:
  - postgres-starter
  - postgres-prisma
  - postgres-sveltekit
---

# Vercel Postgres + Kysely Next.js Starter

Simple Next.js template that uses [Vercel Postgres](https://vercel.com/postgres) as the database and [Kysely](https://kysely.dev/) as the query builder.

## Demo

https://postgres-kysely.vercel.app/

## How to Use

You can choose from one of the following two methods to use this repository:

### One-Click Deploy

Deploy the example using [Vercel](https://vercel.com?utm_source=github&utm_medium=readme&utm_campaign=vercel-examples):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Fexamples%2Ftree%2Fmain%2Fstorage%2Fpostgres-kysely&project-name=postgres-kysely&repository-name=postgres-kysely&demo-title=Vercel%20Postgres%20%2B%20Kysely%20Next.js%20Starter&demo-description=Simple%20Next.js%20template%20that%20uses%20Vercel%20Postgres%20as%20the%20database%20and%20Kysely%20as%20the%20ORM.&demo-url=https%3A%2F%2Fpostgres-kysely.vercel.app%2F&demo-image=https%3A%2F%2Fpostgres-kysely.vercel.app%2Fopengraph-image.png&stores=%5B%7B"type"%3A"postgres"%7D%5D)

### Clone and Deploy

Execute [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app) with [pnpm](https://pnpm.io/installation) to bootstrap the example:

```bash
pnpm create next-app --example https://github.com/vercel/examples/tree/main/storage/postgres-kysely
```

Once that's done, copy the .env.example file in this directory to .env.local (which will be ignored by Git):

```bash
cp .env.example .env.local
```

Then open `.env.local` and set the environment variables to match the ones in your Vercel Storage Dashboard.

Next, run Next.js in development mode:

```bash
pnpm dev
```

Deploy it to the cloud with [Vercel](https://vercel.com/new?utm_source=github&utm_medium=readme&utm_campaign=vercel-examples) ([Documentation](https://nextjs.org/docs/deployment)).

## Event-Driven Mutation Flow

This project now routes write operations through explicit domain events.

- Mutation entrypoints (`app/actions.ts`) dispatch typed events.
- Event handlers live in `lib/events/handlers.ts`.
- Dispatching/persistence lives in `lib/events/dispatch.ts`.
- Events are persisted in the `domain_events` table with status: `pending`, `processed`, or `failed`.

### Database Notes

- `lib/sql/seed.ts` now provisions `domain_events` for event-store persistence.
- Existing `calculate_order_total` trigger remains active and compatible with event-based order item writes.

## Mercado Pago Docs Note

When referencing Mercado Pago external documentation for retrieval/automation, prefer the same docs URL with `.md` appended (markdown-friendly content). If a specific page does not support `.md`, use the original HTML URL as fallback.

## Test Commands (Env-safe)

Use these commands to avoid test-runner/env mismatches:

- Unit tests (Vitest):

   ```bash
   bun run test
   ```

- E2E tests (Playwright + `.env.local` auto-loaded):

   ```bash
   bun run test:e2e
   ```

- Full check (unit + e2e):

   ```bash
   bun run test:all
   ```

Important: do not run Playwright specs with `bun test` directly. That can produce errors like `Playwright Test did not expect test.beforeEach()/test.describe()`.

## Mercado Pago Docs Index

- [Platform + Tenant Architecture](docs/MERCADOPAGO_PLATFORM_TENANT_ARCHITECTURE.md)
- [Issue 24 Context Pack](docs/MERCADOPAGO_ISSUE_24_CONTEXT.md)
- [OAuth Integration](docs/MERCADOPAGO_OAUTH.md)
- [Integration Diagrams](docs/MERCADOPAGO_DIAGRAMS.md)
- [nuqs URL State Guide](docs/NUQS_URL_STATE.md)

## Authentication & Authorization

Cookie-based session management using HMAC-SHA256 signatures (Web Crypto API, zero dependencies).

### Setup

1. Copy the auth env vars template:

   ```bash
   cp .env.local.example .env.local
   ```

2. Generate a secret and paste it into `.env.local`:

   ```bash
   openssl rand -hex 32
   ```

3. Set the env vars:

   | Variable | Required | Default | Description |
   |---|---|---|---|
   | `AUTH_SECRET` | **yes** | — | HMAC signing key (≥ 32 chars) |
   | `AUTH_COOKIE_NAME` | no | `__session` | Session cookie name |
   | `AUTH_SESSION_TTL` | no | `604800` (7 days) | Session lifetime in seconds |
   | `AUTH_ALLOWED_ORIGINS` | no | — | Comma-separated origins for CORS |
   | `AUTH_COOKIE_DOMAIN` | no | — | Cookie domain for cross-service SSO (e.g. `.example.com`) |

### How It Works

- **Middleware** ([middleware.ts](middleware.ts)) protects all routes except `/api/auth/*`, `/_next/*`, and `/favicon.ico`. When `AUTH_SECRET` is not set, auth is bypassed (dev convenience).
- **Session tokens** ([lib/auth/session.ts](lib/auth/session.ts)) are `base64url(payload).base64url(hmac)` — lightweight, Edge-compatible, no JWT library needed.
- **Cross-service cookies** ([lib/auth/cookies.ts](lib/auth/cookies.ts)) use `AUTH_COOKIE_DOMAIN` so a single login covers `orders.example.com`, `inventory.example.com`, etc.

### Auth API Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/auth/login?sub=<id>&redirect=/` | Issue session cookie (MVP stub) |
| GET/POST | `/api/auth/logout` | Clear session cookie |
| GET | `/api/auth/me` | Return current session or 401 |

### Running Auth Tests

```bash
bun vitest run lib/auth/__tests__
```
