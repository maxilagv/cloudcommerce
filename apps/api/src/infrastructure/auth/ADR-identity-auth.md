# ADR: Identity auth implementation boundary

Better Auth remains the selected product-level auth library (ADR-004). Its official Fastify integration is a catch-all
`/api/auth/*` handler, and its Drizzle adapter supports custom table names/fields.

For Phase 1, the domain specification requires canonical tables named `admin_user` and `admin_session`, plus explicit
refresh-token rotation with `family_id`, hashed previous refresh tracking, family revocation on reuse, `access_log`, and
admin-only RBAC. The default Better Auth schema and generated routes do not model all of those domain capabilities as
first-class CloudCommerce concepts.

Decision for this phase: implement the required capabilities in the `identity` domain/application layer using the same
security posture Better Auth documents: httpOnly cookies, `Secure`, `SameSite=Lax`, origin/Fetch Metadata CSRF checks,
revocable database sessions, and Argon2id password hashing. The transport remains tRPC `identity.*`.

When the project later needs OAuth or social providers, add a Better Auth adapter at the infrastructure edge and map it
into the existing `identity` use cases instead of replacing the domain model.
