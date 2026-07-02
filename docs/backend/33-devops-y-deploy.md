# 33 · DevOps y deploy

## Monorepo y scripts

Turborepo + pnpm. Scripts raíz (ya definidos en `package.json`): `dev`, `build`, `lint`, `typecheck`,
`db:generate`, `db:migrate`, `db:seed`. El backend (`apps/api`), workers (`apps/workers`) y packages se
suman al `pnpm-workspace.yaml` cuando tengan `package.json` válido (hoy scoped a `apps/store`).

## Contenedores

Docker multi-stage, usuario **no-root**:

```dockerfile
FROM node:lts-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM node:lts-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:lts-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
USER node
COPY --from=build /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
CMD ["node", "dist/main.js"]
```

Procesos: **api** (Fastify) y **workers** (BullMQ) son contenedores separados que comparten Postgres/Redis.

## Runtime

- Node detrás de reverse proxy / load balancer (TLS, buffering, límites, WAF, DoS) — ver `infrastructure/nginx`.
- Health checks ([30](./30-observabilidad.md)): `/health/live`, `/health/ready`, `/health/startup`.
- Graceful shutdown en SIGTERM ([08](./08-seguridad.md)).
- Filesystem read-only donde se pueda; solo `tmp`/storage escribibles.

## Pipeline CI/CD (mínimo)

```txt
1. install --frozen-lockfile
2. lint
3. typecheck
4. unit tests
5. integration tests (Testcontainers)
6. contract / OpenAPI validation
7. build
8. dependency audit / SCA
9. container build
10. vulnerability scan de la imagen
11. migration dry-run (desde cero)
12. deploy staging
13. smoke tests
14. deploy production con rollback disponible
```

## Branch protection

```txt
- PR obligatorio; no force-push en master
- CI verde obligatorio
- reviews obligatorias para módulos críticos
- secrets scanning
- CODEOWNERS para: identity/auth, orders/checkout, finance/documents, pricing, security
```

## Migraciones

```txt
- Drizzle, versionadas, nombre claro por cambio.
- Cambios destructivos: expand/contract (agregar → backfill por lotes → migrar lectura → contraer).
- Índices grandes: CREATE INDEX CONCURRENTLY.
- Rollback o mitigación documentada; la migración convive con la versión anterior durante la transición.
- Backups probados (no solo configurados).
```

## Ambientes

```txt
development != staging != production
```

Nunca credenciales productivas en local. Nunca `DEBUG=true` en producción. Env validada al boot (falla si
falta crítica). Secrets en secret manager, rotación por runbook.

## Documentación viva

### ADRs
Cada decisión grande tiene ADR ([03](./03-stack-y-decisiones.md)): framework HTTP, ORM, auth, idempotencia,
búsqueda, IA gateway, cola, storage de documentos.

### Runbooks (mínimos)
```txt
- checkout fallando            - DB saturada
- Redis caído                  - cola trabada
- proveedor de envíos caído    - documentos no generan
- 401/403 masivos              - latencia de catálogo alta
- IA no responde               - rotación de secrets
```

### API docs
OpenAPI visible para devs internos (y partners si aplica). Nunca exponer endpoints internos sin auth.
