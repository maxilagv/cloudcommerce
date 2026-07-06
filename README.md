# CloudCommerce

**An open-source commerce operating system for AI-assisted dropshipping.**

CloudCommerce is a production-minded e-commerce monorepo that connects the parts most online stores still run as disconnected tools: storefront, admin operations, supplier feeds, pricing intelligence, fulfillment, customer loyalty, analytics, and AI-assisted selling.

The goal is simple: make it possible to run a lean, automated commerce business where products can move from supplier catalog to customer delivery with less manual work, better margins, and a more intelligent customer experience.

---

## Why This Matters

Most e-commerce stacks still treat the store as the center of the business.

CloudCommerce treats the **entire commerce operation** as the product:

| Old e-commerce pattern | CloudCommerce direction |
| --- | --- |
| A storefront connected to scattered apps | One typed platform for store, admin, backend, workers, and AI |
| Manual product imports | Supplier feeds normalized into the catalog |
| Static markup rules | Margin-aware pricing and optimization services |
| Support and sales handled after the fact | AI-assisted engagement and customer context |
| Fulfillment tracked manually | Order forwarding, supplier hooks, workers, and status updates |
| Growth features bolted on later | Loyalty, customer accounts, analytics, and automation built into the platform |

That is the concrete opportunity: e-commerce stops being a set of screens and becomes an operating layer that can understand products, customers, suppliers, prices, orders, and margins together.

## Product Surfaces

### Storefront

`apps/store` is the public Next.js storefront where customers browse products, compare items, manage cart and checkout flows, view account pages, track orders, and interact with CloudCommerce customer features such as CloudPoints and CloudDigital.

### Admin Panel

`apps/admin` is the private owner cockpit for running the business: products, categories, customers, orders, finance, suppliers, pricing, loyalty, AI tools, store settings, and operational dashboards.

### Main API

`apps/api` is the Fastify + tRPC backend built around domain boundaries. It owns commerce logic, permissions, repositories, integrations, webhooks, and the typed API consumed by the apps.

### AI Service

`apps/ai` is a Python FastAPI microservice for product descriptions, SEO generation, pricing assistance, product image workflows, customer profiling, sales assistance, recommendations, and trend analysis.

### Workers

`apps/workers` runs background jobs for async commerce operations such as order forwarding, media outbox work, engagement follow-up, WhatsApp sending, reservation expiry, and document generation.

## Architecture

```text
cloudcommerce/
├── apps/
│   ├── store/       Public storefront
│   ├── admin/       Owner admin panel
│   ├── api/         Fastify + tRPC commerce backend
│   ├── ai/          Python FastAPI AI microservice
│   └── workers/     BullMQ background workers
├── packages/
│   ├── database/    Drizzle schema, migrations, seeds
│   ├── validators/  Shared Zod contracts
│   ├── types/       Shared TypeScript types
│   ├── ui/          Shared UI primitives and composed components
│   ├── trpc/        Shared tRPC setup
│   ├── email/       React Email templates
│   ├── analytics/   Analytics abstraction
│   └── config/      Shared config
└── infrastructure/
    ├── docker/      Local and production compose files
    ├── terraform/   Cloud infrastructure
    ├── nginx/       Reverse proxy
    └── k8s/         Kubernetes manifests
```

The backend follows **Domain-Driven Design** with clear commerce domains:

- `catalog`: products, categories, inventory, publication rules
- `orders`: order lifecycle, fulfillment, pricing snapshots
- `customers`: customer accounts, addresses, analytics context
- `pricing`: margin rules, resale pricing, recommendations
- `suppliers`: supplier configuration, feeds, API forwarding, SSRF guards
- `storefront`: public customer-facing commerce flows
- `loyalty`: CloudPoints and customer reward logic
- `engagement`: AI-assisted follow-up and WhatsApp workflows
- `finance`: documents, revenue, reports, accounting-friendly state
- `ai`: AI operations, rate limits, target writing, media adapters

## Dropshipping Flow

```text
Supplier feed/API
      ↓
Catalog import and normalization
      ↓
Margin-aware pricing
      ↓
Customer storefront purchase
      ↓
Stripe/payment confirmation
      ↓
Order created in the commerce backend
      ↓
Worker forwards fulfillment to supplier
      ↓
Supplier ships and webhooks update status
      ↓
Customer receives tracking and account updates
```

CloudCommerce is designed so each step can become more automated over time without losing ownership of the business rules.

## AI Capabilities

The AI service is not a chatbot bolted onto a store. It is a commerce assistant layer with structured responsibilities:

| Capability | Purpose |
| --- | --- |
| Product descriptions | Turn supplier data into customer-ready copy |
| SEO generation | Produce metadata, titles, keywords, and search-friendly content |
| Pricing optimization | Suggest margin-safe prices from cost and competitive context |
| Product image workflows | Analyze and improve product imagery |
| Customer profiling | Summarize buying behavior and likely intent |
| Sales assistance | Support guided, context-aware customer engagement |
| Trend analysis | Identify promising products from supplier catalogs |

## Tech Stack

| Layer | Technology |
| --- | --- |
| Monorepo | Turborepo + pnpm |
| Store/Admin | Next.js 15 App Router + TypeScript |
| UI | Tailwind CSS v4 + Radix UI |
| API | Fastify + tRPC v11 |
| Database | PostgreSQL + Drizzle ORM |
| Cache/Queues | Redis + BullMQ |
| AI | Python FastAPI |
| Auth | Better Auth |
| Payments | Stripe |
| Email | React Email + Resend |
| Analytics | PostHog/GA abstraction |
| Infra | Docker, Terraform, Nginx, Kubernetes |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Python 3.12+
- PostgreSQL
- Redis

### Install

```bash
pnpm install
```

### Configure Environment

Copy the example environment files and replace placeholder values with local development values.

```bash
cp .env.example .env
cp apps/ai/.env.example apps/ai/.env
cp apps/store/.env.example apps/store/.env.local
```

Important variables include:

- `DATABASE_URL`
- `REDIS_URL`
- `BETTER_AUTH_SECRET`
- `COOKIE_SECRET`
- `AI_SERVICE_TOKEN`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`

Do not commit real secrets. Example files intentionally use placeholder values.

### Database

```bash
pnpm db:migrate
pnpm db:seed
```

### Development

```bash
pnpm dev
```

This runs the monorepo development tasks through Turborepo.

### Verification

```bash
pnpm typecheck
pnpm test
python -m pytest apps/ai
```

## Security Posture

CloudCommerce is built with open-source readiness in mind:

- Shared Zod validators for frontend and backend input contracts
- Domain permissions for admin, customer, supplier, loyalty, pricing, and AI operations
- Session handling with httpOnly cookie patterns
- SSRF protection for supplier integrations
- Webhook signature validation patterns
- Secret placeholders in example env files
- Local agent/media artifacts ignored by default
- Tests covering identity, suppliers, storefront, loyalty, pricing, AI, orders, and more

Security work is never "done", but the project is structured so critical business boundaries are visible and testable.

## Roadmap

CloudCommerce is moving toward a complete AI-native commerce operator:

- Supplier marketplace adapters
- Product import review workflows
- Pricing experiments and guardrails
- Customer self-service returns portal
- Advanced analytics dashboards
- AI sales agent with stronger policy controls
- Multi-store support
- More payment and shipping providers
- Production deployment blueprints

## Contributing

Contributions are welcome if they keep the platform coherent.

Good contributions usually improve one of these areas:

- Commerce domain correctness
- Security and permissions
- Storefront conversion quality
- Admin operator workflows
- Supplier and fulfillment automation
- AI reliability and prompt safety
- Tests, migrations, and deployment paths
- Documentation that helps real operators build and ship

Before opening a pull request, run:

```bash
pnpm typecheck
pnpm test
python -m pytest apps/ai
```

## License

Add a license before distributing this project broadly as open source.

## Vision

CloudCommerce is a bet that the next generation of online stores will not be defined only by prettier product pages.

They will be defined by how quickly an operator can discover products, price them intelligently, publish them safely, sell with context, fulfill reliably, learn from customers, and improve the whole loop.

That loop is the real e-commerce engine. CloudCommerce is an attempt to make it open, inspectable, and programmable.
