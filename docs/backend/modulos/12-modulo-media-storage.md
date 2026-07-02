# 12 · Módulo Media y Storage (transversal)

> Módulo **transversal**: no es un bounded context de negocio propio, sino un servicio de
> infraestructura de dominio consumido por **catálogo** (productos, marcas) y **categorías**, y
> a futuro por **finanzas** (PDFs de documentos, ver [16](./16-modulo-finanzas.md)). Fija cómo
> entran, se validan, se procesan, se guardan y se sirven los **bytes** (imágenes hoy; documentos
> luego), sin que el dominio sepa dónde viven.

Cubre dos requerimientos del dueño:

1. **Subir imágenes desde su disco** (Windows, unidad C:) — flujo de upload local en dev.
2. **Generar imágenes por IA** — delegado al servicio IA vía el AI Gateway ([17](./17-modulo-ia-gateway.md)).

Ambos terminan en el **mismo** `media_asset`; la única diferencia es `source` (`upload` vs `ai`).
Cardinalidad **1..6 imágenes por producto** (canon [04](../04-modelo-de-datos.md)).

Fundacionales que este documento da por sentados: [04 Modelo de datos](../04-modelo-de-datos.md),
[05 Convenciones API](../05-convenciones-api.md), [06 Validaciones §Validación de archivos](../06-validaciones.md),
[07 Auth](../07-auth-identidad.md), [08 Seguridad](../08-seguridad.md), ADR-009 en
[03 Stack](../03-stack-y-decisiones.md).

---

## 1. Propósito y alcance

### En alcance

- Puerto `MediaStoragePort` con **dos adapters**: filesystem local (dev, subir desde C:) y
  S3-compatible (prod, con CDN + URLs firmadas).
- **Flujo de upload seguro**: validación por **magic bytes** (no extensión), allowlist
  (`jpg/png/webp/avif`), límites de tamaño por archivo y por request, nombre saneado, storage
  **fuera del webroot**, remoción de EXIF sensible, **checksum** + **dedupe** por checksum.
- Asociación de assets a productos: cardinalidad **1..6** (`product_media.position 0..5`),
  imagen principal (`product.main_image_id`), reordenar, `alt_text`.
- **Procesamiento async** (thumbnails, `dominant_color`, `blur_placeholder`) por job
  ([32](../32-jobs-y-async.md)).
- **URLs firmadas** con expiración; **autorización antes de descarga**.
- **Generación por IA**: delega la creación del bitmap al servicio IA ([17](./17-modulo-ia-gateway.md));
  el asset resultante se persiste con `media_asset.source = 'ai'`.

### Fuera de alcance (referenciado, no definido aquí)

- La **inteligencia** de la generación de imágenes (prompts, modelo, costos): vive en `apps/ai` y
  se expone por `AiGatewayPort` ([17](./17-modulo-ia-gateway.md)).
- Reglas de publicación del producto (qué falta para `PUBLISHED`): [10](./10-modulo-catalogo.md).
- Generación de PDFs de documentos comerciales: [16](./16-modulo-finanzas.md) (reutiliza el mismo puerto de storage).
- Job runtime, colas, DLQ, backoff: [32](../32-jobs-y-async.md).

### Principio rector del módulo

> El **dominio no sabe** dónde viven los bytes ni cómo se sirven. Solo conoce un `MediaAssetId`
> y metadata derivada (dimensiones, color, placeholder, alt). Todo lo físico (path, bucket, CDN,
> firma) queda detrás del puerto. Cambiar de filesystem a S3 es cambiar un adapter, no el dominio.

---

## 2. Entidades y tablas (canon [04](../04-modelo-de-datos.md))

Este módulo **no introduce** tablas nuevas: usa las ya definidas en `schema/catalog.ts`. Se
transcriben aquí para referencia, sin divergir del canon.

```
media_asset       id, storage_key, mime, byte_size, width?, height?,
                  dominant_color?, blur_placeholder?, alt_text?, source(upload/ai/import),
                  checksum, created_by, created_at
product_media     id, product_id(FK), media_asset_id(FK), position(int 0..5), alt_text
                  # CHECK: máx 6 filas por product (1..6 imágenes) — validado en app + índice
product           ... main_image_id?(FK media_asset) ...
category          ... image_id?(FK media_asset) ...
brand             ... logo_id?(FK media_asset) ...
```

### Notas sobre `media_asset`

- **`storage_key`** — clave lógica **opaca** relativa al backend de storage (no una URL, no una
  ruta absoluta de disco). El adapter la resuelve a path físico o key de bucket. Formato sugerido:
  `media/{yyyy}/{mm}/{uuidv7}.{ext}` (ver §3.3). Nunca contiene el nombre original del archivo.
- **`mime`** — el MIME **real detectado por magic bytes**, no el `Content-Type` declarado por el cliente.
- **`checksum`** — `sha256` del contenido de bytes normalizado (post-strip EXIF). Base de la **dedupe** (§4).
- **`source`** — `upload` (disco del dueño), `ai` (generada por IA), `import` (feed de proveedor,
  [20](./20-modulo-suppliers.md)).
- **`width/height/dominant_color/blur_placeholder`** — se llenan **async** por job; al crear el
  asset pueden estar `NULL` (estado "processing" implícito). No bloquean la asociación pero sí la
  publicación (§7).
- **`created_by`** — `admin_user_id` que originó el asset (auditoría). Para `source='ai'`, el actor
  que disparó la generación.

### Estado ilustrativo derivado (no es columna)

Un asset es **usable** cuando existe en storage, pasó validación, y su procesamiento terminó
(`width`/`height` no nulos). Se modela como estado derivado, no como enum persistido (mantiene la
tabla del canon intacta):

```txt
uploaded    → fila creada, bytes en storage, checksum OK, metadata visual pendiente
ready       → job de procesamiento completó (width/height/dominant_color/blur listos)
failed      → job de procesamiento falló definitivamente (asset queda inutilizable → GC)
```

### DDL ilustrativa de invariantes (solo referencia; el canon ya define columnas)

```sql
-- Cardinalidad y posición: 0..5, únicas por producto.
ALTER TABLE product_media
  ADD CONSTRAINT chk_product_media_position CHECK (position BETWEEN 0 AND 5);
CREATE UNIQUE INDEX uq_product_media_product_position
  ON product_media(product_id, position);
-- Un mismo asset no se asocia dos veces al mismo producto.
CREATE UNIQUE INDEX uq_product_media_product_asset
  ON product_media(product_id, media_asset_id);
-- Dedupe por contenido: un checksum → un asset.
CREATE UNIQUE INDEX uq_media_asset_checksum ON media_asset(checksum);
-- Índice de lectura de galería (ya en canon §Índices mínimos).
-- CREATE INDEX idx_product_media_product_pos ON product_media(product_id, position);
```

> El **CHECK de "máx 6 filas por producto"** no es expresable en un `CHECK` de fila; se garantiza
> en el caso de uso (§5, `AttachMediaToProduct`) dentro de la transacción **contando bajo lock**,
> y el `UNIQUE(product_id, position)` con `position BETWEEN 0 AND 5` lo hace imposible de violar en DB.

---

## 3. Puerto `MediaStoragePort` y adapters

El puerto vive en `application/ports/` del módulo. El dominio depende de la **interfaz**, nunca del
adapter. Selección de adapter por env (`STORAGE_DRIVER=local|s3`), validada al boot (ADR-005).

### 3.1 Interfaz TypeScript (ilustrativa)

```ts
// modules/catalog/media/application/ports/media-storage.port.ts

/** Clave lógica opaca relativa al backend de storage. NO es URL ni path absoluto. */
export type StorageKey = string & { readonly __brand: 'StorageKey' };

export interface PutObjectInput {
  readonly key: StorageKey;                // ya saneada y generada por el caso de uso
  readonly bytes: Buffer;                  // bytes ya validados y EXIF-limpios
  readonly contentType: string;            // MIME real detectado por magic bytes
  readonly cacheControl?: string;          // p.ej. 'public, max-age=31536000, immutable'
  readonly metadata?: Record<string, string>; // checksum, source, createdBy (no PII)
}

export interface SignedUrlInput {
  readonly key: StorageKey;
  readonly expiresInSeconds: number;       // acotado por policy (§6), p.ej. 60..900
  readonly disposition?: 'inline' | 'attachment';
  readonly downloadFilename?: string;      // saneado, para 'attachment'
}

export interface StoredObject {
  readonly key: StorageKey;
  readonly byteSize: number;
  readonly contentType: string;
}

export interface MediaStoragePort {
  /** Persiste bytes ya validados. Idempotente por key (misma key = mismo objeto). */
  put(input: PutObjectInput): Promise<StoredObject>;

  /** URL de lectura firmada y con expiración. En local, URL a un endpoint proxy autenticado. */
  getSignedUrl(input: SignedUrlInput): Promise<{ url: string; expiresAt: string }>;

  /** Streaming controlado (fallback cuando no se usan URLs firmadas directas). */
  getStream(key: StorageKey): Promise<NodeJS.ReadableStream>;

  /** Existe el objeto. Usado por dedupe y GC. */
  exists(key: StorageKey): Promise<boolean>;

  /** Borrado físico (GC de assets huérfanos/fallidos). No borra la fila DB. */
  remove(key: StorageKey): Promise<void>;
}
```

> El puerto **no** valida, **no** genera checksums, **no** decide autorización: eso vive en el caso
> de uso (§4, §5). El puerto solo mueve bytes y firma URLs.

### 3.2 Adapter local — `LocalFsMediaStorage` (dev, subir desde C:)

```txt
Config:   STORAGE_DRIVER=local
          STORAGE_LOCAL_ROOT=C:\cloudcommerce-storage\media   (FUERA del webroot de Next/Fastify)
          STORAGE_PUBLIC_PROXY=/api/v1/media   (endpoint autenticado que hace streaming)
```

- Escribe en `STORAGE_LOCAL_ROOT/<storage_key>`. Ese directorio **no** está servido estáticamente
  por ningún servidor: nunca es `apps/store/public` ni `apps/api` static. Se sirve **solo** vía el
  endpoint proxy autenticado (§6, `GET /api/v1/media/:assetId`) que valida permiso y hace streaming.
- `getSignedUrl` en local devuelve una URL al **proxy** con un token HMAC de corta expiración
  (mismo contrato que prod, para no divergir el frontend): `/api/v1/media/:assetId?exp=...&sig=...`.
- Path traversal imposible: la `storage_key` es generada por el backend (uuidv7 + ext de allowlist),
  jamás derivada del nombre subido. Se valida que el path resuelto quede **dentro** de
  `STORAGE_LOCAL_ROOT` (defensa en profundidad).
- Es el camino que resuelve el requerimiento **"subir desde la unidad C"**: el dueño elige archivos
  en su disco desde el panel; el navegador los envía por multipart; el backend los guarda en
  `STORAGE_LOCAL_ROOT`.

### 3.3 Adapter S3-compatible — `S3MediaStorage` (prod, CDN + firmadas)

```txt
Config:   STORAGE_DRIVER=s3
          STORAGE_S3_BUCKET, STORAGE_S3_REGION, STORAGE_S3_ENDPOINT (S3/R2/MinIO),
          STORAGE_S3_ACCESS_KEY, STORAGE_S3_SECRET (secret manager),
          STORAGE_CDN_BASE_URL (dominio CDN delante del bucket)
```

- `put` sube el objeto **privado** (ACL private / bucket sin acceso público). Nunca objetos públicos permanentes.
- `getSignedUrl` genera una **presigned GET** (SDK S3) con expiración corta, o firma una URL de CDN
  (signed cookie / query) si el CDN está delante. Expiración acotada por policy (§6).
- `Cache-Control: public, max-age=31536000, immutable` sobre las **variantes derivadas** (thumbnails)
  cuyo key incluye hash → cache-busting natural. El **original** puede llevar cache más conservador.
- Generación de `storage_key`: `media/{yyyy}/{mm}/{uuidv7}.{ext}`. Determinística por asset, opaca.

### 3.4 Regla de dependencia

```txt
domain           → conoce MediaAssetId + metadata; NO conoce el puerto.
application       → usa MediaStoragePort (interfaz).
infra/storage/    → LocalFsMediaStorage | S3MediaStorage (implementan el puerto).
container.ts      → inyecta el adapter según STORAGE_DRIVER (validado en boot).
```

---

## 4. Flujo de upload paso a paso + validaciones

Transporte: **REST multipart** para los binarios (tRPC no transporta binarios eficientemente,
ver §6). El endpoint recibe **un** archivo por request (o N acotado); cada archivo pasa por el
pipeline. Toda regla de [06 §Validación de archivos](../06-validaciones.md) se aplica aquí.

```txt
 1. AuthN + AuthZ          → adminProcedure equivalente: sesión admin válida + permiso
                             media:upload (rol OWNER/ADMIN/CATALOG_MANAGER). Ver §8.
 2. Rate limit + cuota     → por actor: N uploads/min y M MB/hora (§6). 429 si excede.
 3. Límite de tamaño       → request body limit (MAX_REQUEST_BYTES) a nivel Fastify (rechazo
                             temprano, antes de bufferizar). Por archivo: MAX_FILE_BYTES.
 4. Parse multipart        → streaming con @fastify/multipart, límites duros:
                             files=1..N, fileSize=MAX_FILE_BYTES, fields acotados.
                             Cortar el stream apenas se supera el límite (no bufferizar de más).
 5. Magic bytes            → leer los primeros bytes y detectar el MIME REAL (file-type/sniffing).
                             Rechazar si el MIME real ∉ allowlist, AUNQUE la extensión/Content-Type
                             digan lo contrario (anti "polyglot"/doble extensión).
 6. Allowlist              → { image/jpeg, image/png, image/webp, image/avif }. Extensión derivada
                             del MIME REAL, no del nombre subido.
 7. Coherencia extensión   → si el nombre trae extensión, debe coincidir con el MIME real; si no,
                             se ignora el nombre y se usa la ext canónica del MIME.
 8. Decodificación segura  → validar que el bitmap decodifica (sharp/vips) con límites de
                             dimensiones (MAX_WIDTH/MAX_HEIGHT) y de píxeles (anti "decompression
                             bomb"). Rechazar imágenes con dimensiones absurdas.
 9. Strip EXIF/metadata    → remover metadata sensible (GPS/geo, orientación se aplica y se limpia,
                             cámara, timestamps). Se re-encodea a un buffer limpio y canónico.
10. Checksum               → sha256 del buffer limpio → `checksum`.
11. Dedupe                 → SELECT media_asset WHERE checksum = ?  (uq_media_asset_checksum).
                             Si existe → NO se re-sube; se reutiliza el asset existente
                             (se devuelve su id). Ahorra storage y evita duplicados.
12. Nombre saneado         → el nombre original NUNCA se usa como key. storage_key = uuidv7 + ext.
                             (El nombre original puede guardarse como metadata no ejecutable/no PII
                             si se necesita para UX, saneado; opcional.)
13. put() en storage       → MediaStoragePort.put({ key, bytes, contentType, cacheControl, metadata })
14. INSERT media_asset     → source='upload', mime, byte_size, checksum, created_by; width/height/
                             color/blur NULL (pendientes).
15. Encolar job            → media.process(assetId) → thumbnails, dominant_color, blur_placeholder
                             ([32](../32-jobs-y-async.md)). Ver §10.
16. Respuesta              → 201 { data: { asset: { id, source, byteSize, mime } } }.
                             El asset aún NO está asociado a producto (eso es AttachMediaToProduct, §5).
```

### Validaciones resumidas (contrato con [06](../06-validaciones.md))

| Regla | Valor / mecanismo |
|---|---|
| Tamaño máx por archivo | `MAX_FILE_BYTES` (p.ej. 8 MB imagen) — rechazo en streaming |
| Tamaño máx por request | `MAX_REQUEST_BYTES` (p.ej. 24 MB) — body limit Fastify |
| MIME real | **magic bytes**, no header ni extensión |
| Allowlist | `jpg/png/webp/avif` (por MIME real) |
| Dimensiones | `MAX_WIDTH`/`MAX_HEIGHT` + límite de megapíxeles (anti-bomb) |
| Nombre | saneado; **jamás** usado como key; key = uuidv7 |
| Storage | **fuera del webroot**; nunca servido estáticamente |
| EXIF | strip de geo/metadata sensible; re-encode canónico |
| Integridad | `sha256` checksum |
| Dedupe | `UNIQUE(checksum)` → reutiliza asset |
| Antivirus | opcional (hook en el job si `CLAMAV_ENABLED`) |

Los límites viven en `setting`/env validados al boot; el schema Zod de la ruta valida los campos
de metadata (no los bytes).

---

## 5. Casos de uso (`application/`)

Cada uno recibe un `Actor` tipado ([07](../07-auth-identidad.md)); la autorización de negocio vive
aquí, no solo en el middleware. Errores tipados (Result, ADR-012) mapeados a §9.

### 5.1 `UploadMediaCommand`

```txt
actor:    admin con permiso media:upload
input:    stream multipart (1 archivo) + { source: 'upload' } (implícito)
efecto:   pipeline §4 completo → crea (o reutiliza por dedupe) media_asset
tx:       INSERT media_asset + encolar media.process en el MISMO commit (outbox si aplica)
salida:   { assetId, source, mime, byteSize, deduped: boolean }
errores:  FILE_TOO_LARGE, UNSUPPORTED_MEDIA_TYPE, MALFORMED_IMAGE, RATE_LIMITED, FORBIDDEN
eventos:  MediaUploaded(assetId, source, checksum)
```

### 5.2 `AttachMediaToProductCommand`

```txt
actor:    admin con permiso product:write (CATALOG_MANAGER/ADMIN/OWNER) sobre ese producto
input:    { productId, assetId, position?, altText? }
reglas:   - el asset existe y es del tipo imagen
          - dentro de tx, SELECT ... FOR UPDATE / count con lock sobre product_media(productId):
            si ya hay 6 filas → MEDIA_LIMIT_EXCEEDED (1..6, canon 04)
          - position: si se omite, se asigna la siguiente libre (0..5); si se pasa, debe estar
            libre y en rango → si ocupada, se reordena o se rechaza (policy: reordenar por defecto)
          - altText normalizado (trim, max len)
          - si es la PRIMERA imagen del producto → set product.main_image_id = assetId (auto)
efecto:   INSERT product_media(productId, assetId, position, altText)
salida:   { productMediaId, position }
errores:  MEDIA_LIMIT_EXCEEDED, MEDIA_ALREADY_ATTACHED, RESOURCE_NOT_FOUND, FORBIDDEN
eventos:  ProductMediaAttached(productId, assetId, position)
```

### 5.3 `ReorderProductMediaCommand`

```txt
actor:    admin con product:write sobre el producto
input:    { productId, order: assetId[] }   // permutación completa de las imágenes actuales
reglas:   - `order` debe ser exactamente el conjunto de assets asociados (ni más ni menos)
          - longitud 1..6
          - dentro de tx: reasignar position 0..N-1 según el array (evitar colisión temporal:
            usar offset o defer del UNIQUE, o update en dos fases)
efecto:   UPDATE product_media.position para cada fila
salida:   { productId, order }
errores:  MEDIA_ORDER_MISMATCH (el set no coincide), RESOURCE_NOT_FOUND, FORBIDDEN
eventos:  ProductMediaReordered(productId)
```

### 5.4 `SetMainImageCommand`

```txt
actor:    admin con product:write sobre el producto
input:    { productId, assetId }
reglas:   - el asset DEBE estar ya asociado al producto (existe fila product_media)
          - el asset debe estar `ready` (procesado) — no permitir principal rota
efecto:   UPDATE product.main_image_id = assetId
salida:   { productId, mainImageId }
errores:  MEDIA_NOT_ATTACHED, MEDIA_NOT_READY, RESOURCE_NOT_FOUND, FORBIDDEN
eventos:  ProductMainImageChanged(productId, assetId)
```

> Convención UX opcional: `main_image_id` puede espejar `position=0`. Se elige **columna explícita**
> (`main_image_id`) como verdad para desacoplar "principal" de "orden de galería" y permitir que la
> portada no sea necesariamente la primera de la tira.

### 5.5 `RemoveMediaFromProductCommand` (implícito, completa el ABM)

```txt
reglas:   - no dejar el producto PUBLISHED sin imagen principal (§7): si se remueve la principal
            y quedan otras, promover otra a principal; si era la única y el producto está publicado
            → MEDIA_MIN_NOT_MET (bloquear) o despublicar según policy de catálogo.
          - al quedar el asset huérfano (sin product_media ni referencia en category/brand/product),
            el job de GC lo elimina de storage.
efecto:   DELETE product_media + recompactar positions
eventos:  ProductMediaRemoved(productId, assetId)
```

### 5.6 `GenerateProductImageWithAICommand`

Delega la **creación del bitmap** al servicio IA; el resultado se ingiere por el **mismo** pipeline
de validación (§4) y se persiste con `source='ai'`.

```txt
actor:    admin con permiso ai:use + product:write (OWNER/ADMIN/CATALOG_MANAGER)
input:    { productId, prompt, style?, count? (1..N acotado) }
flujo:    1. registrar ai_generation(kind='image', target_type='product', target_id, actor) → [17]
          2. AiGatewayPort.generateImage({ prompt, ... })  → devuelve bytes o una URL temporal
             del servicio IA (validada: no SSRF, ver §11).
          3. INGERIR por el pipeline §4: magic bytes, allowlist, límites, strip EXIF, checksum,
             dedupe. La IA no es fuente confiable de bytes: se valida IGUAL que un upload.
          4. INSERT media_asset(source='ai', created_by=actor) + encolar media.process.
          5. (opcional) AttachMediaToProduct si el input lo pide.
rate:     rate limit + cuota de costo por actor (IA es cara) — [08](../08-seguridad.md)/[17].
salida:   { assetId, source: 'ai', aiGenerationId }
errores:  UPSTREAM_UNAVAILABLE (IA caída → 502/503), AI_CONTENT_REJECTED (no pasó validación),
          RATE_LIMITED, FORBIDDEN
eventos:  MediaUploaded(assetId, source='ai'), AiImageGenerated(assetId, aiGenerationId)
```

> Regla de oro: **una imagen IA no es distinta de una subida** una vez validada. El único rastro de
> su origen es `media_asset.source='ai'` + el vínculo con `ai_generation` para auditoría y costos.

### 5.7 `GetSignedUrlQuery`

```txt
actor:    admin (panel) o public (store, solo assets de productos PUBLISHED)
input:    { assetId, disposition?, ttl? }
reglas:   - AUTORIZAR antes de firmar (§6, §8): ¿el actor puede ver este asset?
            · público: solo si el asset pertenece a un producto/categoría PUBLISHED/activa.
            · admin: según rol.
          - ttl acotado por policy (min/max); nunca ttl arbitrario del cliente.
          - el asset debe estar `ready`.
efecto:   MediaStoragePort.getSignedUrl(...) (S3 presigned / proxy HMAC en local)
salida:   { url, expiresAt }
errores:  RESOURCE_NOT_FOUND (asset inexistente o no autorizado → 404 anti-enumeración),
          MEDIA_NOT_READY
```

---

## 6. Endpoints

Dos transportes ([05](../05-convenciones-api.md)): **REST multipart** para binarios,
**tRPC `media.*`** para metadata/asociación (JSON tipado).

### 6.1 REST — subida de binarios (multipart)

```txt
POST /api/v1/media/uploads
  Auth:        admin (cookie sesión) + permiso media:upload
  Content-Type: multipart/form-data
  Body:        file (1 archivo)  [+ opcional: source hint, no confiable]
  Límites:     body size = MAX_REQUEST_BYTES ; fileSize = MAX_FILE_BYTES ; files ≤ N
  Rate limit:  por actor: p.ej. 30 uploads/min y 200 MB/hora (cuota) → 429 + Retry-After
  201:         { data: { asset: { id, source, mime, byteSize, deduped } }, meta:{requestId} }
  Errores:     413 FILE_TOO_LARGE, 415 UNSUPPORTED_MEDIA_TYPE, 422 MALFORMED_IMAGE,
               401 UNAUTHENTICATED, 403 FORBIDDEN, 429 RATE_LIMITED
  OpenAPI:     sí (endpoint público REST → contrato)
```

```txt
GET /api/v1/media/:assetId
  Proxy de lectura autenticado (streaming controlado). En local ES el sustituto de la URL firmada;
  en prod queda como fallback si no se usa presigned directa.
  Auth:        firma HMAC (?exp=&sig=) O sesión admin; AUTORIZA antes de servir bytes (§8).
  Headers:     Content-Type real, Cache-Control acorde, Content-Disposition (inline|attachment).
  200:         stream de bytes ; 404 si no autorizado (anti-enumeración) ; 410 si firma expiró.
```

> **Por qué REST y no tRPC para binarios**: tRPC serializa JSON; subir multipart/streaming por tRPC
> es ineficiente y pierde los límites nativos de `@fastify/multipart`. El binario entra por REST;
> la app admin luego asocia el `assetId` por tRPC.

### 6.2 tRPC — `media.*` (metadata y asociación)

Router `media` compuesto en `appRouter` ([05](../05-convenciones-api.md)). Inputs **siempre** con
schema Zod de `packages/validators`.

```txt
media.getSignedUrl({ assetId, disposition?, ttl? })      query   → { url, expiresAt }
media.getAsset({ assetId })                              query   → metadata pública (sin campos internos)
media.attachToProduct({ productId, assetId, position?, altText? })   mutation → adminProcedure
media.detachFromProduct({ productId, assetId })          mutation → adminProcedure
media.reorderProductMedia({ productId, order: uuid[] })  mutation → adminProcedure
media.setMainImage({ productId, assetId })               mutation → adminProcedure
media.updateAltText({ productMediaId, altText })         mutation → adminProcedure
media.generateProductImage({ productId, prompt, style?, count? })    mutation → adminProcedure (ai:use)
media.listProductMedia({ productId })                    query    → adminProcedure → galería ordenada
```

- `getAsset`/`getSignedUrl` pueden ser `publicProcedure` **solo** para assets de recursos
  publicados (la autorización se decide en el caso de uso, no en el middleware).
- Todo lo demás es `adminProcedure` + permiso fino en el caso de uso.

### 6.3 Schemas de entrada (Zod, `packages/validators/src/media.ts`, ilustrativo)

```ts
export const AttachMediaSchema = z.object({
  productId: z.string().uuid(),
  assetId:   z.string().uuid(),
  position:  z.number().int().min(0).max(5).optional(),
  altText:   z.string().trim().max(160).optional(),
});

export const ReorderProductMediaSchema = z.object({
  productId: z.string().uuid(),
  order:     z.array(z.string().uuid()).min(1).max(6),
});

export const GenerateProductImageSchema = z.object({
  productId: z.string().uuid(),
  prompt:    z.string().trim().min(3).max(1000),
  style:     z.enum(['studio', 'lifestyle', 'flat']).optional(),
  count:     z.number().int().min(1).max(4).default(1),
});

export const SignedUrlSchema = z.object({
  assetId:     z.string().uuid(),
  disposition: z.enum(['inline', 'attachment']).default('inline'),
  ttl:         z.number().int().min(60).max(900).optional(), // acotado por policy
});
```

---

## 7. Reglas e invariantes

```txt
- Cardinalidad: 1..6 imágenes por producto. product_media.position ∈ [0,5], única por producto.
  Séptima imagen → MEDIA_LIMIT_EXCEEDED. Verificado bajo lock en la tx (§5.2).
- Imagen principal OBLIGATORIA en PUBLISHED: un producto no puede pasar a PUBLISHED sin
  main_image_id apuntando a un asset `ready` y asociado (product_media). Esta regla la ENFORZA el
  módulo catálogo en su policy de publicación ([10](./10-modulo-catalogo.md)); media provee el dato.
- La imagen principal debe estar `ready` (procesada) y no rota — prohibido asset roto en publicado
  (Skill §12.5).
- La primera imagen asociada se vuelve principal automáticamente (UX), reasignable con SetMainImage.
- Remover la principal reordena/promueve otra; si deja al producto publicado sin imagen → bloquea
  o despublica según policy de catálogo.
- Dedupe global por checksum: dos uploads idénticos comparten un único media_asset (UNIQUE checksum).
- Un asset puede ser referenciado por varios recursos (producto, categoría, marca): el GC solo
  borra bytes cuando NO queda ninguna referencia.
- alt_text: recomendado para accesibilidad/SEO; obligatorio en principal de producto publicado
  (policy de catálogo, soft-warning en draft).
- source es inmutable: un asset no cambia de 'ai' a 'upload'. La identidad de origen se preserva.
- storage_key es inmutable y opaca; no se re-deriva del nombre del archivo.
```

---

## 8. Permisos ([07](../07-auth-identidad.md))

La media es parte del ABM de catálogo → sigue la fila **"Crear/editar/publicar producto"** de la
matriz de [07](../07-auth-identidad.md).

| Acción | OWNER | ADMIN | CATALOG_MANAGER | FINANCE | SUPPORT |
|---|:--:|:--:|:--:|:--:|:--:|
| Subir media (`media:upload`) | ✔ | ✔ | ✔ | ✖ | ✖ |
| Asociar / reordenar / principal / alt | ✔ | ✔ | ✔ | ✖ | ✖ |
| Generar imagen IA (`ai:use` + `product:write`) | ✔ | ✔ | ✔ | ✖ | ✖ |
| Ver signed URL de asset de producto **publicado** | ✔ | ✔ | ✔ | ✔ | ✔ / público |
| Ver signed URL de asset de **draft** | ✔ | ✔ | ✔ | ✖ | ✖ |
| Borrar asset / GC | ✔ | ✔ | ✔ (restringido) | ✖ | ✖ |

- La **autorización de descarga** (`GetSignedUrl` / proxy) se resuelve en el caso de uso: público
  solo ve assets de recursos publicados; admin según rol. Recurso no autorizado → **404**
  (anti-enumeración, [05](../05-convenciones-api.md)).
- Acceso admin a media de un recurso no propio: no aplica ownership de cliente aquí (todo es del
  dueño), pero sí RBAC por rol.

---

## 9. Errores tipados ([05](../05-convenciones-api.md), ADR-012)

Errores de dominio → `code` público + HTTP. No exponer detalle técnico ni path de disco ni bucket.

| code | HTTP | Cuándo |
|---|:--:|---|
| `UNSUPPORTED_MEDIA_TYPE` | 415 | MIME real ∉ allowlist (jpg/png/webp/avif) |
| `FILE_TOO_LARGE` | 413 | Excede `MAX_FILE_BYTES` o `MAX_REQUEST_BYTES` |
| `MALFORMED_IMAGE` | 422 | No decodifica, dimensiones/megapíxeles fuera de rango (bomb) |
| `MEDIA_LIMIT_EXCEEDED` | 409 | Séptima imagen (1..6) |
| `MEDIA_ALREADY_ATTACHED` | 409 | Asset ya asociado a ese producto |
| `MEDIA_NOT_ATTACHED` | 409 | SetMainImage sobre asset no asociado |
| `MEDIA_NOT_READY` | 409 | Asset aún procesándose (usar como principal / firmar) |
| `MEDIA_ORDER_MISMATCH` | 422 | `order[]` no coincide con el set de assets del producto |
| `MEDIA_MIN_NOT_MET` | 422 | Quitar la única imagen de un producto publicado |
| `AI_CONTENT_REJECTED` | 422 | El bitmap IA no pasó la validación §4 |
| `RESOURCE_NOT_FOUND` | 404 | Asset/producto inexistente o no autorizado (anti-enum) |
| `RATE_LIMITED` | 429 | Cuota de uploads / IA superada (+ `Retry-After`) |
| `UPSTREAM_UNAVAILABLE` | 502/503 | Servicio IA o storage caído |

Mensajes públicos claros, no técnicos ("El archivo no es una imagen válida (JPG, PNG, WebP o AVIF)."),
nunca `sharp: unsupported...` ni el path de C:.

---

## 10. Jobs de procesamiento ([32](../32-jobs-y-async.md))

El request path **no** hace trabajo pesado de imagen (ADR-006 / Skill §10.1). El upload persiste el
original y encola; el job hace el resto.

```txt
Job: media.process(assetId)
  Trigger:   al crear media_asset (upload o IA), vía cola BullMQ (productor en infra/queue).
  Pasos:     1. cargar original desde storage (por storage_key)
             2. (opcional) antivirus si CLAMAV_ENABLED → si infectado: marcar failed + GC
             3. leer dimensiones → UPDATE width, height
             4. calcular dominant_color → UPDATE dominant_color
             5. generar blur_placeholder (LQIP base64 pequeño) → UPDATE blur_placeholder
             6. generar variantes/thumbnails (p.ej. 320/640/1280 webp+avif), subirlas con
                key derivada (media/.../{assetId}@{w}.{fmt}) — cache inmutable
             7. marcar asset `ready` (derivado: width/height no nulos)
  Reglas:    idempotente (reprocesar no duplica), reintentos con backoff, DLQ, timeout, logs por
             jobId con requestId original. Ver [32](../32-jobs-y-async.md) §Reglas de job perfecto.
  Fallo def: asset queda `failed` → GC lo elimina; el producto no puede usarlo como principal.

Job: media.gc (scheduled)
  Busca media_asset sin ninguna referencia (product_media / product.main_image_id /
  category.image_id / brand.logo_id) por más de X horas, o assets `failed`, y borra bytes
  (MediaStoragePort.remove) + fila. Procesa en lotes. Idempotente.
```

- Mientras el asset no está `ready`, el frontend puede mostrar el `blur_placeholder` cuando exista,
  o un skeleton; no se permite como imagen principal de un publicado (§7).

---

## 11. Seguridad ([08](../08-seguridad.md))

```txt
- Magic bytes obligatorio: nunca confiar en extensión ni Content-Type declarado (anti polyglot,
  doble extensión, SVG con script → SVG NO está en allowlist justamente por vector XSS).
- Storage fuera del webroot: los bytes jamás se sirven estáticamente; siempre por endpoint
  autorizado o URL firmada de corta expiración. No hay URLs públicas permanentes.
- URLs firmadas: expiración corta (60..900s), firma no manipulable (HMAC/presigned). Autorizar
  SIEMPRE antes de firmar/servir (BOLA/BFLA — [08](../08-seguridad.md)).
- SSRF (crítico si se importa por URL): la generación IA puede devolver una URL temporal, y un
  futuro "importar imagen por URL" recibe URLs del usuario. Antes de que el backend haga fetch:
    · solo http/https ; bloquear localhost, 127.0.0.0/8, 10/8, 172.16/12, 192.168/16, link-local
      (169.254/16), IPv6 ULA/loopback, y metadata services (169.254.169.254).
    · resolver DNS y validar la IP resuelta (anti DNS-rebinding); re-validar tras cada redirect;
      límite de redirects; timeout; límite de bytes descargados.
    · el contenido descargado pasa por el MISMO pipeline §4 (magic bytes, límites, EXIF, dedupe).
  Ver [08](../08-seguridad.md) §SSRF. Un usuario nunca fuerza al backend a leer recursos internos.
- Decompression bomb: límite de megapíxeles y de bytes de salida al decodificar (sharp/vips
  con límites), no solo de bytes de entrada.
- EXIF/geo: removida siempre (privacidad); re-encode canónico elimina metadata activa.
- Prototype pollution: si se aceptan campos de metadata (alt, tags), sanear claves __proto__/
  constructor/prototype ([06](../06-validaciones.md)).
- Rate limit + cuota por actor (uploads y IA); IA además con tope de costo ([17](./17-modulo-ia-gateway.md)).
- Path traversal (local adapter): key generada por backend, resolución validada dentro de root.
- Logs sin PII ni secrets: nunca loggear el path absoluto de C:, el bucket, ni tokens de firma.
- Antivirus (opcional): hook en media.process si CLAMAV_ENABLED.
```

---

## 12. Definition of Done ([backend.md §28](../../../.claude/Skills/backend/backend.md))

```txt
[ ] MediaStoragePort definido; LocalFsMediaStorage y S3MediaStorage implementan la interfaz.
[ ] Selección de adapter por STORAGE_DRIVER validada al boot (zod-env); no arranca sin config.
[ ] Storage local apunta FUERA del webroot (STORAGE_LOCAL_ROOT en C:), nunca servido estático.
[ ] Pipeline de upload completo: magic bytes, allowlist, límites archivo+request, decode seguro,
    strip EXIF, checksum sha256, dedupe por UNIQUE(checksum), key uuidv7 (nombre saneado ignorado).
[ ] Cardinalidad 1..6 garantizada: CHECK position 0..5 + UNIQUE(product_id, position) + conteo
    bajo lock en AttachMediaToProduct.
[ ] main_image_id: primera imagen auto-principal; SetMainImage; principal obligatoria y `ready`
    para publicar (regla enforzada por catálogo, dato provisto por media).
[ ] Casos de uso con Actor tipado y autorización en application: Upload, Attach, Reorder,
    SetMainImage, Remove, GenerateProductImageWithAI, GetSignedUrl.
[ ] Generación IA delega en AiGatewayPort; bytes IA re-validados por el MISMO pipeline; source='ai'
    + vínculo ai_generation para auditoría/costos.
[ ] REST multipart para binarios (body/file size limits, rate limit) + tRPC media.* para metadata.
[ ] URLs firmadas con expiración acotada; autorización ANTES de firmar/servir; 404 anti-enumeración.
[ ] Jobs media.process (thumbnails, dominant_color, blur, ready) y media.gc: idempotentes, backoff,
    DLQ, timeout, logs con requestId.
[ ] Errores tipados mapeados a code+HTTP; mensajes públicos no técnicos; sin fuga de path/bucket.
[ ] SSRF cubierto para import por URL / URLs temporales de IA; SVG excluido del allowlist.
[ ] Permisos por rol (media:upload, product:write, ai:use) testeados, incl. autorización negativa.
[ ] OpenAPI del endpoint REST + tipos tRPC actualizados; validadores en packages/validators.
[ ] Tests: upload válido/ inválido (mime, tamaño, bomb), dedupe, límite 1..6, reorder, principal,
    IA rechazada, signed URL no autorizada → 404, GC de huérfanos.
[ ] Logs sin PII/secrets; métricas de uploads y de latencia de procesamiento si crítico.
```
