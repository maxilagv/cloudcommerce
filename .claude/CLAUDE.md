# CloudCommerce — Dropshipping E-commerce Platform

## What this project is

A production-grade dropshipping e-commerce monorepo. The owner imports products from suppliers, sells them in the store at a markup, and orders are automatically fulfilled by the supplier. Two user-facing surfaces:

1. **Store** (`apps/store`) — public e-commerce storefront where customers browse, buy, and track orders.
2. **Admin Panel** (`apps/admin`) — private dashboard for the store owner: manage products, orders, suppliers, pricing, and AI tools.

Customer self-service portal (order tracking, returns) is a future phase — not yet implemented.

## Monorepo layout

```
cloudcommerce/
├── apps/
│   ├── store/          Next.js 15 — public customer-facing store
│   ├── admin/          Next.js 15 — owner admin panel
│   ├── api/            Fastify + tRPC — main backend
│   ├── ai/             Python FastAPI — AI microservice
│   └── workers/        BullMQ workers — background jobs
├── packages/
│   ├── ui/             Shared React component library (Radix + Tailwind)
│   ├── database/       Drizzle ORM schema + migrations + queries
│   ├── trpc/           Shared tRPC client/server setup
│   ├── validators/     Shared Zod schemas (used on both front and back)
│   ├── types/          Shared TypeScript types and enums
│   ├── config/         Shared ESLint, TypeScript, Tailwind configs
│   ├── email/          React Email transactional templates
│   └── analytics/      PostHog/GA analytics abstraction layer
└── infrastructure/
    ├── docker/         Docker Compose for local dev and prod
    ├── terraform/      IaC for cloud deployment
    ├── nginx/          Reverse proxy config
    └── k8s/            Kubernetes manifests
```

## Tech stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Monorepo | Turborepo + pnpm | Best-in-class build caching, task orchestration |
| Frontend | Next.js 15 App Router + TypeScript | RSC, streaming, best DX |
| Styling | Tailwind CSS v4 + Radix UI | Accessible primitives, utility-first |
| State | Zustand | Lightweight, no boilerplate |
| API (Node) | Fastify + tRPC v11 | Fastest HTTP, end-to-end type safety |
| ORM | Drizzle ORM | SQL-first, fully typed, no magic |
| Database | PostgreSQL | Primary data store |
| Cache | Redis | Sessions, query cache, rate limiting |
| Queues | BullMQ (Redis) | Background jobs, retries, scheduling |
| AI | Python FastAPI + Anthropic SDK | Product descriptions, pricing, trends |
| Auth | Better Auth | Modern, sessions + OAuth |
| Email | React Email + Resend | Type-safe email templates |
| Payments | Stripe | Checkout, webhooks, refunds |
| Analytics | PostHog | Product analytics, feature flags |
| Observability | OpenTelemetry | Traces, metrics from day 1 |
| IaC | Terraform | Reproducible cloud infra |

## Backend architecture (apps/api)

Follows **Domain-Driven Design (DDD)** + **CQRS** (commands and queries are separate files per domain):

```
src/domains/
├── catalog/
│   ├── product/        entity, repository, service, commands, queries, events, value-objects
│   ├── category/       entity, repository, service
│   └── inventory/      entity, repository, service, events
├── orders/
│   ├── order/          entity, repository, service, commands, queries, events, value-objects
│   ├── fulfillment/    service, events
│   └── shipping/       service, providers (shipping rate APIs)
├── customers/
│   ├── customer/       entity, repository, service, commands, queries
│   └── address/        entity, repository
├── payments/
│   └── payment/        entity, service, events, providers (Stripe)
└── suppliers/
    ├── supplier/        entity, repository, service
    └── feed/            processor, mappers (parses supplier CSV/API feeds)
```

Domain events are dispatched via `shared/events/event-bus.ts` (in-process, synchronous for now — can be replaced with Redis pub/sub for multi-instance).

Interfaces layer:
- `interfaces/http/` — REST routes for external access / webhooks
- `interfaces/trpc/` — type-safe procedures consumed by Next.js apps
- `interfaces/webhooks/` — Stripe and supplier webhook handlers

## Key conventions

- **Zod validators** live in `packages/validators` and are imported by both frontend and backend — single source of truth for form validation and API input parsing.
- **Database schema** lives in `packages/database/src/schema/` — Drizzle schema files, one per domain. Run `pnpm db:migrate` to apply.
- **Type definitions** shared across apps live in `packages/types/` — enums, API response shapes, domain types.
- **Shared UI components** in `packages/ui/` — `primitives/` are thin Radix wrappers, `composed/` are higher-level components (DataTable, FormField, Pagination), `layouts/` are page structure components.
- **Background jobs** (BullMQ) live in `apps/workers/` — this process runs separately from the API. Jobs are defined in `src/jobs/`, queues in `src/queues/`, and scheduled jobs in `src/processors/scheduled.ts`.

## AI microservice (apps/ai)

Python FastAPI service that the API backend calls via HTTP. Provides:
- `POST /products/generate-description` — Anthropic Claude generates product descriptions from title/specs
- `POST /products/generate-seo` — Title, meta, keywords optimization
- `POST /pricing/optimize` — Suggests margin-safe prices based on competitor data
- `POST /trends/analyze` — Identifies trending products from supplier catalog

## Common commands

```bash
pnpm install              # Install all dependencies
pnpm dev                  # Run all apps in development mode
pnpm build                # Build all apps
pnpm db:generate          # Generate Drizzle migrations
pnpm db:migrate           # Apply migrations to local DB
pnpm db:seed              # Seed development data
pnpm lint                 # Lint all packages
pnpm typecheck            # Type-check all packages
```

## Environment variables

See `.env.example` at root. Each app also has its own `.env.local` for secrets. Key vars:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
- `ANTHROPIC_API_KEY` — for AI service
- `RESEND_API_KEY` — transactional emails
- `BETTER_AUTH_SECRET` — auth secret

## Dropshipping flow

1. Supplier feeds (CSV/API) are processed by `apps/api/src/domains/suppliers/feed/`
2. Products are imported to the catalog with markup pricing
3. Customer places order → Stripe payment → order created
4. Worker (`jobs/orders/process-order.ts`) forwards order to supplier API
5. Supplier ships → webhook updates fulfillment status
6. Customer receives tracking email via React Email + Resend
