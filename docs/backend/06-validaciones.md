# 06 · Validaciones

Nada entra al dominio sin validación. Los schemas Zod viven en `packages/validators` y se comparten con el
front (única fuente de verdad de forma de entrada).

## Las cuatro capas (ninguna reemplaza a otra)

| Nivel | Qué valida | Ejemplo |
|-------|-----------|---------|
| **Transporte** | forma, tipos, tamaños, formatos | `email`, `uuid`, `limit <= 50` |
| **Aplicación** | permisos, estado inicial, existencia | el admin puede editar ese producto |
| **Dominio** | invariantes irrompibles | no reservar stock negativo |
| **Persistencia** | constraints definitivas | unique slug, FK, CHECK |

## Validación de entrada

Todo input externo pasa por schema: `body`, `params`, `query`, headers relevantes, cookies, **webhooks**,
**archivos**, y **respuestas de terceros antes de confiar en ellas**.

```ts
// packages/validators/src/order.ts
export const CreateCartItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
});
```

Ejemplo del pedido del dueño (alta de cliente):

```ts
// packages/validators/src/customer.ts
export const CreateCustomerSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName:  z.string().trim().min(1).max(80),
  whatsapp:  z.string().regex(/^\+?\d{8,15}$/).optional(),   // opcional
  email:     z.string().email().toLowerCase().optional(),
  notes:     z.string().max(1000).optional(),
});

export const CustomerAddressSchema = z.object({
  province:      z.string().trim().min(1).max(60),
  city:          z.string().trim().min(1).max(80),
  street:        z.string().trim().min(1).max(120),
  streetNumber:  z.string().trim().max(20).optional(),   // "si aplica"
  betweenStreets:z.string().trim().max(160).optional(),  // "entre calles"
  postalCode:    z.string().regex(/^\d{4,8}$/).optional(),
  isPrimary:     z.boolean().default(false),
});
```

## Validación de salida

Los responses importantes pasan por **presenters tipados**. En endpoints críticos se valida también el
output contra schema (al menos en tests / no-producción). Motivo: evitar fuga de campos internos como
`costPrice`, `supplierId`, `deletedAt`, `passwordHash`, `internalNotes`, `supplier_cost_snapshot_minor`.

## Normalización (antes de persistir)

```txt
- trim de strings
- lowercase de emails
- slugify controlado de slugs
- normalización Unicode donde aplique
- límites de longitud
- sanitización de HTML si se permite contenido enriquecido (descripciones IA)
- dinero en enteros menores; redondeo determinístico
```

## Dinero (crítico)

- **Nunca** `float` para dinero persistente. Modelo `{ amountMinor: int, currency }` (ADR-007).
- El **backend recalcula** todos los totales (subtotal, envío, descuento, impuestos, total). El frontend
  muestra, **no decide**. No aceptar precio final desde el cliente.
- Descuentos auditables; redondeos determinísticos.
- Reconciliación: el helper `formatCOP` del store se renombra a `formatARS` (moneda base ARS).

## IDs y ownership (anti BOLA/IDOR)

Validar que el ID sea formalmente correcto **no alcanza**. También que el actor pueda operar sobre él.

```txt
✗  GET /orders/:id → buscar orden y devolverla si existe
✓  GET /orders/:id → buscar orden por id + (customerId del actor  o  permiso admin explícito)
```

Recurso ajeno → `404`/`403` según política, **nunca 200**. Esto se testea explícitamente ([31](./31-testing.md)).

## Mass assignment

Nunca mapear `req.body` directo a entidad/actualización ORM.

```ts
// ✗
await db.update(user).set(req.body);
// ✓
const input = UpdateProfileSchema.parse(req.body);
await updateProfile.execute(actor, { displayName: input.displayName, whatsapp: input.whatsapp });
```

## Prototype pollution

Sanear objetos; evitar merge profundo inseguro con datos del usuario. Bloquear claves `__proto__`,
`prototype`, `constructor`. Relevante en `attributes`/`specs` jsonb.

## Validación de archivos (uploads)

Para imágenes de producto/categoría y documentos (detalle en [12](./modulos/12-modulo-media-storage.md)):

```txt
- tamaño máximo por archivo y por request
- MIME real por magic bytes (no solo header/extensión)
- extensión permitida (allowlist: jpg/png/webp/avif)
- nombre saneado; storage fuera del webroot
- metadata EXIF removida si trae datos sensibles (geo)
- 1..6 imágenes por producto (cardinalidad)
- URLs firmadas con expiración; autorización antes de descarga
- antivirus si aplica
```

## Validación de terceros y webhooks

- Respuestas de proveedores de envío / IA / pagos se validan con schema antes de usarse.
- Webhooks: firma HMAC/mecanismo oficial + timestamp anti-replay + idempotencia por `eventId` +
  schema de payload. Nunca asumir entrega única ni en orden. Ver [08](./08-seguridad.md) §Webhooks.
