# 10 · Módulo Catálogo (dominio `catalog`)

> Especificación de **diseño**, no implementación. Incluye firmas de tipos, endpoints, schemas Zod
> ilustrativos y DDL conceptual. La verdad de columnas/enums/índices ya está fijada en
> [04 · Modelo de datos](../04-modelo-de-datos.md); acá **no se redefine**, se referencia y se le agrega
> comportamiento (casos de uso, invariantes, permisos, eventos, jobs).

Este módulo cubre el pedido explícito del dueño: **ABM de productos y ABM de categorías**. Es el
corazón del panel admin (admin-first, ver [README](../README.md)) y la fuente que alimenta el catálogo
público del store.

---

## 1. Propósito y alcance

### En alcance

- **Categorías y subcategorías** en árbol (`category.parent_id`, auto-relación) con imagen subible desde
  disco. El "cómo" del upload/almacenamiento se delega a
  [12 · Media y storage](./12-modulo-media-storage.md).
- **Productos**: alta/edición/baja, adjudicación de categoría, marca, nombre (`title`), subtítulo,
  descripción, especificaciones **estructuradas** (`spec_group`/`spec_item`), y **1 a 6 imágenes**
  (`product_media`, cardinalidad `1..6`).
- **Variantes** (color/capacity como en `mock-product-detail.ts`), atributos, `brand`, `slug` +
  `slug_history` (redirect 301 SEO), campos SEO.
- **Ciclo de vida** del producto (`ProductStatus`) y reglas de publicación.
- **Generación por IA** de descripción, especificaciones e imágenes: se delega a
  [17 · IA Gateway](./17-modulo-ia-gateway.md) y [12 · Media](./12-modulo-media-storage.md).
- **Read model de card** (`ProductCardData`) para catálogo público y grillas del dashboard.

### Fuera de alcance (referenciado, no implementado acá)

- **Precio** y márgenes → [14 · Pricing](./14-modulo-pricing.md). El producto **no** guarda precio.
- **Stock / disponibilidad** → [13 · Inventario](./13-modulo-inventario.md). El producto **no** guarda stock.
- **Reviews / rating** → dominio futuro; en cards se lee por read model (ver [18](./18-modulo-dashboard-analytics.md)).
- **Import de feeds de proveedor** → [20 · Suppliers](./20-modulo-suppliers.md) (crea productos usando los
  mismos casos de uso de este módulo).
- **Búsqueda facetada avanzada / motor externo** → este módulo expone búsqueda básica (pg_trgm + filtros
  whitelist); indexación pesada se delega a jobs (§10).

### Principio rector del módulo

> El `product` es un **documento de contenido comercial**. Precio, stock, rating, envío y "nuevo" **no**
> son columnas de verdad: se **derivan** de otros dominios y se materializan en el read model de card
> ([04 §Reconciliación](../04-modelo-de-datos.md)). Así se elimina la duplicación que hoy tiene el front
> (`ProductCardData` vs `types.ts`).

---

## 2. Entidades y tablas

Tablas canónicas en [04 · Modelo de datos §catalog](../04-modelo-de-datos.md#catalog-schemacatalogts).
**No se redefinen columnas**; se resume el rol de cada tabla y su mapeo a entidades de dominio.

| Tabla (04) | Entidad de dominio | Rol |
|---|---|---|
| `category` | `Category` | Nodo del árbol de categorías (`parent_id` self-FK). Imagen vía `image_id`. |
| `brand` | `Brand` | Marca. Referenciada por `product.brand_id`. |
| `product` | `Product` (aggregate root) | Contenido comercial: `slug`, `title`, `subtitle`, `description`, `status`, SEO, `main_image_id`, `category_id`, `brand_id`. |
| `product_media` | `ProductMedia` (value object del agregado) | 1..6 imágenes ordenadas (`position 0..5`) + `alt_text`. |
| `product_variant` | `ProductVariant` | Variante vendible: `sku`, `attributes` jsonb (`{color, capacity}`), `is_active`. Ancla de pricing/inventory. |
| `spec_group` / `spec_item` | `SpecGroup` / `SpecItem` | Especificaciones estructuradas (`value_num` + `unit` habilita filtros/comparación). |
| `media_asset` | `MediaAsset` | Binario físico (delegado a [12](./12-modulo-media-storage.md)); `source ∈ upload/ai/import`. |
| `product_slug_history` | `SlugHistory` | Slugs viejos para redirect 301. |

### Value objects de dominio (ilustrativo)

```ts
// domains/catalog/domain/value-objects/
class Slug {           // slugify determinístico, único por scope, nunca es identidad primaria
  static create(raw: string): Result<Slug, InvalidSlug>;
  readonly value: string; // /^[a-z0-9]+(?:-[a-z0-9]+)*$/, 3..120
}
class Sku {             // opcional a nivel product, obligatorio y único a nivel variant
  readonly value: string; // trim, upper, 1..64
}
class AttributeSet {    // attributes de variante, validado contra AttributeDefinition de la categoría
  readonly values: Record<string, string>; // p.ej. { color: "negro-intenso", capacity: "655l" }
}
class ImageRef { readonly mediaAssetId: string; readonly position: number; readonly altText: string; }
```

### Agregado `Product` (límite transaccional)

El agregado `Product` posee: sus `product_media` (1..6), sus `spec_group`/`spec_item`, y sus
`product_variant`. Precio, stock, reviews **no** están dentro del agregado: se consultan por **port** a
pricing/inventory (ver [02 §Comunicación entre módulos](../02-arquitectura.md)). Una transacción de escritura
nunca cruza a tablas de otro dominio.

---

## 3. Casos de uso (commands / queries)

Formato por caso de uso (según [02 §capa application](../02-arquitectura.md) y skill §3.4): **actor · input
(Zod) · permiso · transacción · eventos · salida · errores**. Todos reciben un `Actor` tipado
([07 §Contexto de auth](../07-auth-identidad.md)), nunca el request crudo. Los schemas Zod viven en
`packages/validators/src/catalog.ts` y se comparten con el front ([06](../06-validaciones.md)).

### 3.1 Commands — Categorías

#### `CreateCategoryCommand`
- **Actor**: admin `OWNER | ADMIN | CATALOG_MANAGER`.
- **Input**:
  ```ts
  export const CreateCategorySchema = z.object({
    name:           z.string().trim().min(1).max(80),
    parentId:       z.string().uuid().optional(),        // undefined ⇒ raíz
    description:    z.string().trim().max(1000).optional(),
    imageAssetId:   z.string().uuid().optional(),         // media ya subida (ver [12])
    position:       z.number().int().min(0).optional(),
    seoTitle:       z.string().trim().max(70).optional(),
    seoDescription: z.string().trim().max(160).optional(),
  });
  ```
- **Permiso**: `catalog.category.create`.
- **Transacción**: sí (insert `category` + resolución de `slug` único por `parent_id`).
- **Eventos**: `CategoryCreated`.
- **Salida**: `CategoryResponse` (presenter, sin campos internos).
- **Errores**: `VALIDATION_FAILED`, `CATEGORY_PARENT_NOT_FOUND`, `CATEGORY_SLUG_TAKEN`,
  `CATEGORY_DEPTH_EXCEEDED` (profundidad máx, ver §5).

#### `UpdateCategoryCommand`
- **Actor / permiso**: igual a create (`catalog.category.update`).
- **Input**: `id` + campos parciales del create (**mass assignment prohibido**, [06 §mass assignment](../06-validaciones.md)). Cambiar `name` puede regenerar `slug` (con confirmación) → registra `SlugHistory`.
- **Eventos**: `CategoryUpdated`; si cambió slug: `CategorySlugChanged`.
- **Errores**: `RESOURCE_NOT_FOUND`, `CATEGORY_SLUG_TAKEN`, `CATEGORY_CYCLE` (reparent que crea ciclo).

#### `MoveCategoryCommand` (reparent / reordenar)
- **Input**: `{ id, newParentId?: uuid|null, newPosition?: int }`.
- **Invariantes**: no permitir mover un nodo bajo su propio descendiente (`CATEGORY_CYCLE`); respetar
  profundidad máxima.
- **Eventos**: `CategoryMoved`.

#### `SetCategoryImageCommand`
- **Input**: `{ id, imageAssetId: uuid }`. El asset debe existir y ser imagen válida (validación en [12]).
- **Eventos**: `CategoryUpdated`.

#### `ArchiveCategoryCommand` (baja lógica)
- **Regla**: no se borra físicamente si tiene productos o subcategorías activas → se marca `is_active=false`
  (o se exige reasignar). Errores: `CATEGORY_NOT_EMPTY`.
- **Eventos**: `CategoryArchived`.

### 3.2 Commands — Productos

#### `CreateProductCommand`
- **Actor**: `OWNER | ADMIN | CATALOG_MANAGER`.
- **Input**:
  ```ts
  export const CreateProductSchema = z.object({
    title:       z.string().trim().min(3).max(140),
    subtitle:    z.string().trim().max(160).optional(),
    description: z.string().trim().max(20_000).optional(),   // HTML saneado si enriquecido ([06])
    categoryId:  z.string().uuid(),
    brandId:     z.string().uuid().optional(),
    sku:         z.string().trim().max(64).optional(),
    seoTitle:       z.string().trim().max(70).optional(),
    seoDescription: z.string().trim().max(160).optional(),
    // Creación opcional en el mismo request (o vía comandos dedicados):
    variants:    z.array(CreateVariantSchema).max(50).optional(),
    specGroups:  z.array(SpecGroupSchema).max(30).optional(),
    mediaAssetIds: z.array(z.string().uuid()).min(0).max(6).optional(),
  });
  ```
- **Permiso**: `catalog.product.create`.
- **Transacción**: sí (product + media + specs + variants en una unidad de trabajo).
- **Estado inicial**: `ProductStatus.DRAFT` (nunca nace publicado).
- **Eventos**: `ProductCreated`.
- **Salida**: `ProductAdminResponse` (incluye campos de edición; **no** costo proveedor salvo permiso).
- **Errores**: `VALIDATION_FAILED`, `CATEGORY_NOT_FOUND`, `BRAND_NOT_FOUND`, `PRODUCT_SLUG_TAKEN`,
  `SKU_TAKEN`, `TOO_MANY_IMAGES`.

#### `UpdateProductContentCommand`
- **Input**: `id` + parciales (`title, subtitle, description, categoryId, brandId, seo*`). Cambio de `title`
  puede proponer nuevo `slug` (flag `regenerateSlug`) → `SlugHistory`.
- **Eventos**: `ProductUpdated`; si cambió slug: `ProductSlugChanged`.
- **Errores**: `RESOURCE_NOT_FOUND`, `PRODUCT_SLUG_TAKEN`, `CATEGORY_NOT_FOUND`.

#### `SetProductMediaCommand` (gestión de 1..6 imágenes)
- **Input**:
  ```ts
  export const SetProductMediaSchema = z.object({
    productId: z.string().uuid(),
    items: z.array(z.object({
      mediaAssetId: z.string().uuid(),
      position:     z.number().int().min(0).max(5),
      altText:      z.string().trim().min(1).max(160),
    })).min(1).max(6),
    mainImagePosition: z.number().int().min(0).max(5).default(0),
  });
  ```
- **Invariantes**: `1 ≤ items ≤ 6`; `position` únicos y contiguos `0..n-1`; `main_image_id` apunta a una fila
  existente. Ver §5.
- **Eventos**: `ProductMediaChanged`.
- **Errores**: `TOO_MANY_IMAGES`, `TOO_FEW_IMAGES`, `MEDIA_ASSET_NOT_FOUND`, `DUPLICATE_MEDIA_POSITION`.

#### `SetProductSpecsCommand`
- **Input**: reemplaza el set de `spec_group` + `spec_item` (transaccional, delete+insert del árbol de specs).
  ```ts
  export const SpecItemSchema = z.object({
    key:   z.string().trim().min(1).max(60),   // slug interno estable
    label: z.string().trim().min(1).max(80),
    valueText: z.string().trim().max(200).optional(),
    valueNum:  z.number().optional(),
    unit:      z.string().trim().max(16).optional(),
    position:  z.number().int().min(0),
  }).refine(v => v.valueText != null || v.valueNum != null, { message: "spec sin valor" });
  export const SpecGroupSchema = z.object({
    name: z.string().trim().min(1).max(80),
    position: z.number().int().min(0),
    items: z.array(SpecItemSchema).min(1).max(60),
  });
  ```
- **Sanitización**: bloquear claves `__proto__/prototype/constructor` en jsonb/keys ([06 §prototype pollution](../06-validaciones.md)).
- **Eventos**: `ProductSpecsChanged`.

#### `AddProductVariantCommand` / `UpdateProductVariantCommand` / `DeactivateProductVariantCommand`
- **Input variante**:
  ```ts
  export const CreateVariantSchema = z.object({
    productId: z.string().uuid(),           // implícito en Add-sobre-producto
    sku:       z.string().trim().min(1).max(64),
    title:     z.string().trim().min(1).max(120),
    attributes: z.record(z.string().max(40), z.string().max(80)).default({}), // {color, capacity,...}
    position:  z.number().int().min(0).default(0),
  });
  ```
- **Permiso**: `catalog.product.update`.
- **Eventos**: `VariantAdded` / `VariantUpdated` / `VariantDeactivated`.
- **Nota cross-dominio**: al crear variante, pricing e inventory pueden inicializar `supplier_cost`/`stock_item`
  por evento (no lo hace catálogo). `DeactivateProductVariantCommand` **no** borra: `is_active=false` (una
  variante referenciada por órdenes históricas nunca se elimina).
- **Errores**: `SKU_TAKEN`, `LAST_ACTIVE_VARIANT` (no desactivar la última variante activa de un producto
  publicado → primero pausar el producto).

#### `PublishProductCommand` — el caso de uso crítico
- **Actor**: `OWNER | ADMIN | CATALOG_MANAGER`, permiso `catalog.product.publish`.
- **Precondición**: `CanPublishProductPolicy` (§5) satisfecha; si no → `PRODUCT_NOT_PUBLISHABLE` (422) con
  `details[]` de lo que falta.
- **Transacción**: sí (set `status=PUBLISHED`, `published_at=now()` si primera vez) + **outbox**
  `ProductPublished`.
- **Eventos**: `ProductPublished` (vía outbox → indexación búsqueda, warm de read model de card,
  invalidación de cache).
- **Salida**: `ProductAdminResponse` con `status=PUBLISHED`.

#### `PauseProductCommand` / `ArchiveProductCommand` / `UnpublishToDraftCommand`
- Transiciones de `ProductStatus` (§5 máquina de estados). Emiten `ProductPaused` / `ProductArchived` /
  `ProductUnpublished`. `ARCHIVED` es terminal salvo `RestoreProductCommand` (a `DRAFT`).
- **Soft delete**: `DeleteProductCommand` = `ArchiveProductCommand` + `deleted_at` (nunca hard delete si hay
  historial de órdenes). Errores: `INVALID_PRODUCT_STATE`.

#### Comandos asistidos por IA (delegan a [17](./17-modulo-ia-gateway.md))
- `GenerateProductDescriptionCommand` → llama `AiGatewayPort.generateDescription(context)`; el resultado se
  guarda como `description` **en estado borrador para revisión humana** (no auto-publica). Registra
  `ai_generation`.
- `GenerateProductSpecsCommand` → devuelve `spec_group`/`spec_item` propuestos; el admin confirma con
  `SetProductSpecsCommand`.
- `GenerateProductImageCommand` → pide imagen a IA, que se materializa como `media_asset` con
  `source='ai'` ([12](./12-modulo-media-storage.md)); luego `SetProductMediaCommand`.
- **Regla**: la IA **propone**, el admin **dispone**. Nada generado por IA se publica sin acción explícita.
  Permiso `catalog.ai.use` (mapea a "Usar herramientas IA" de [07](../07-auth-identidad.md)).

### 3.3 Queries

| Query | Actor | Salida | Notas |
|---|---|---|---|
| `SearchProductsQuery` | público / admin | página de `ProductCardData` | filtros whitelist + cursor ([05](../05-convenciones-api.md)). Público: solo `PUBLISHED`. Admin: cualquier status. |
| `GetProductDetailQuery` | público / admin | `ProductDetailResponse` | por `slug` o `id`; público exige `PUBLISHED`; incluye media, specs, variantes, breadcrumb. Resuelve slug viejo → 301 (§4). |
| `GetProductForEditQuery` | admin | `ProductAdminResponse` | incluye estado, checklist de publicación, refs a media/specs/variants. |
| `ListCategoriesTreeQuery` | público / admin | árbol `CategoryNode[]` | cacheable (árbol estable). Público: solo `is_active`. |
| `GetCategoryQuery` | público / admin | `CategoryResponse` | por `slug`/`id`. |
| `ListBrandsQuery` | público / admin | `BrandResponse[]` | para facetas y selects del admin. |
| `GetPublishChecklistQuery` | admin | `PublishChecklist` | qué falta para `PUBLISHED` (proyección de la policy, sin mutar). |

**Read model de card** (`ProductCardData`): `SearchProductsQuery` **no** hace joins gigantes a pricing/inventory
en el request path (skill §17.2). Lee de una proyección materializada (`catalog_card_read_model`, propiedad de
[18](./18-modulo-dashboard-analytics.md)) que combina: `product` + `main_image` + `brand`/`category` denormalizados
+ `price`/`compare_at` (de pricing) + `stockStatus` (de inventory) + rating (futuro). Reconciliación con el
contrato del front en §12 de este doc no existe — ver §11.

---

## 4. Endpoints

### 4.1 tRPC `catalog.*` (store + admin, [05 §tRPC](../05-convenciones-api.md))

Naming: `query = get*/list*/search*`; `mutation = create*/update*/delete*/publish*/…`. Input **siempre**
schema Zod de `packages/validators`.

```txt
# Queries (publicProcedure salvo indicado)
catalog.searchProducts(SearchProductsInput)      → Page<ProductCardData>
catalog.getProductDetail({ slugOrId })           → ProductDetailResponse (+ redirect si slug viejo)
catalog.listCategoriesTree()                     → CategoryNode[]
catalog.getCategory({ slugOrId })                → CategoryResponse
catalog.listBrands()                             → BrandResponse[]

# Admin (adminProcedure + permiso en el caso de uso)
catalog.admin.createProduct(CreateProductInput)         → ProductAdminResponse
catalog.admin.updateProduct(UpdateProductContentInput)  → ProductAdminResponse
catalog.admin.setProductMedia(SetProductMediaInput)     → ProductAdminResponse
catalog.admin.setProductSpecs(SetProductSpecsInput)     → ProductAdminResponse
catalog.admin.addVariant(CreateVariantInput)            → VariantResponse
catalog.admin.updateVariant(UpdateVariantInput)         → VariantResponse
catalog.admin.deactivateVariant({ variantId })          → VariantResponse
catalog.admin.publishProduct({ productId })             → ProductAdminResponse
catalog.admin.pauseProduct({ productId })               → ProductAdminResponse
catalog.admin.archiveProduct({ productId })             → ProductAdminResponse
catalog.admin.getProductForEdit({ productId })          → ProductAdminResponse
catalog.admin.getPublishChecklist({ productId })        → PublishChecklist
catalog.admin.createCategory(CreateCategoryInput)       → CategoryResponse
catalog.admin.updateCategory(UpdateCategoryInput)       → CategoryResponse
catalog.admin.moveCategory(MoveCategoryInput)           → CategoryResponse
catalog.admin.archiveCategory({ categoryId })           → CategoryResponse
# IA (adminProcedure + permiso catalog.ai.use)
catalog.admin.ai.generateDescription({ productId, hints? })  → { draft: string }
catalog.admin.ai.generateSpecs({ productId, hints? })        → { proposedSpecGroups }
catalog.admin.ai.generateImage({ productId, prompt })        → { mediaAssetId }
```

### 4.2 REST público ([05 §REST](../05-convenciones-api.md), OpenAPI obligatorio)

```txt
GET /api/v1/catalog/categories                 → árbol de categorías activas (cacheable)
GET /api/v1/catalog/categories/:slug           → categoría + hijos
GET /api/v1/catalog/products                    → lista paginada (cursor) con filtros whitelist
GET /api/v1/catalog/products/:slugOrId          → detalle de producto PUBLISHED
GET /api/v1/catalog/brands                      → marcas visibles
```

- Solo **lectura** y solo productos `PUBLISHED` (la escritura es admin-only vía tRPC).
- `GET /products/:slugOrId` con **slug viejo** ⇒ `301` + header `Location` al slug vigente (resuelto por
  `product_slug_history`), para SEO.
- Envelope de éxito y `pageInfo` de cursor según [05](../05-convenciones-api.md). `X-Request-Id` propagado.
- Filtros whitelist (idénticos a los `SortKey`/facetas del store): `category, brand, priceMin, priceMax,
  ratingMin, availability, attributes[color], attributes[capacity], sort ∈
  relevance|price-asc|price-desc|rating|newest`.

---

## 5. Reglas de negocio e invariantes

### 5.1 Máquina de estados de `ProductStatus`

Enum canónico ([04](../04-modelo-de-datos.md)): `DRAFT · READY_FOR_REVIEW · PUBLISHED · PAUSED · ARCHIVED`.

```txt
DRAFT ──────────────▶ READY_FOR_REVIEW ──publish──▶ PUBLISHED
  ▲                         │                          │  ▲
  └──────unpublish──────────┘                     pause│  │resume
                                                       ▼  │
                                                     PAUSED
Cualquiera (salvo ARCHIVED) ──archive──▶ ARCHIVED ──restore──▶ DRAFT
```

- Solo `PUBLISHED` aparece en el catálogo público (skill §12.2). `PAUSED` = fuera de venta temporal
  conservando contenido. `ARCHIVED` = retirado (soft delete, no reaparece en listas admin por defecto).
- Toda transición valida `actor`, `estado actual` y motivo cuando aplique. Transición inválida →
  `INVALID_PRODUCT_STATE` (409).

### 5.2 `CanPublishProductPolicy` — qué falta para `PUBLISHED`

Un producto **no** puede publicarse si falta (skill §12.3, [04 §catalog](../04-modelo-de-datos.md)):

```txt
[ ] title no vacío (≥3)
[ ] slug válido y único
[ ] category_id asignada (categoría activa)
[ ] brand_id asignada            (recomendado; ver §11 decisión abierta)
[ ] main_image_id válido y ≥1 fila en product_media (1..6)
[ ] description pública no vacía
[ ] al menos 1 spec_group con 1 spec_item
[ ] al menos 1 product_variant activa
[ ] esa variante tiene precio vigente en pricing  (consulta por PricingPort)
[ ] esa variante es vendible en inventory         (consulta por InventoryPort; no exige stock>0 si SOON)
[ ] seo_title y seo_description mínimos
```

La policy es **consultada** (no muta) por `GetPublishChecklistQuery` para pintar el checklist en el admin, y
**exigida** por `PublishProductCommand`. Precio y stock se verifican vía **ports** (nunca JOIN a otro dominio,
[02 §reglas de dependencia](../02-arquitectura.md)).

### 5.3 Invariantes de dominio (irrompibles)

- **Imágenes**: `1 ≤ product_media ≤ 6`; `position` únicos `0..n-1`; `main_image_id ∈ product_media`.
  Prohibido asset roto en producto `PUBLISHED` (skill §12.5). CHECK de cardinalidad en DB + validación app
  ([04](../04-modelo-de-datos.md)).
- **Slug**: único por scope (`product.slug` global; `category.slug` único por `parent_id`). Cambiar slug
  siempre escribe `product_slug_history`/equivalente para redirect 301. El slug **no** es identidad primaria
  (skill §11.3).
- **SKU**: `product_variant.sku` único global; `product.sku` opcional único.
- **Categoría**: árbol sin ciclos; profundidad máxima **3** (raíz → sub → sub-sub) — decisión de §11.
  No archivar categoría con productos/subcategorías activas.
- **Variante**: no vender variante archivada/bloqueada (skill §3.3). No desactivar la última variante activa
  de un producto publicado sin pausarlo primero.
- **Specs estructuradas**: cada `spec_item` tiene `value_text` o `value_num` (no ambos vacíos). `value_num`+
  `unit` habilita filtros/comparación.
- **Precio/stock derivados**: prohibido persistirlos en `product`/`product_variant` como verdad
  ([04 §regla de oro](../04-modelo-de-datos.md)).

---

## 6. Permisos (matriz de [07](../07-auth-identidad.md))

Extracto aplicable, versionado en `permission_grant`. `CATALOG_MANAGER` es el rol natural de este módulo;
`FINANCE`/`SUPPORT` no editan catálogo.

| Acción (permiso) | OWNER | ADMIN | CATALOG_MANAGER | FINANCE | SUPPORT |
|---|:--:|:--:|:--:|:--:|:--:|
| `catalog.product.read` (admin) | ✔ | ✔ | ✔ | lectura | lectura |
| `catalog.product.create` / `.update` | ✔ | ✔ | ✔ | ✖ | ✖ |
| `catalog.product.publish` | ✔ | ✔ | ✔ | ✖ | ✖ |
| `catalog.product.archive` | ✔ | ✔ | ✔ | ✖ | ✖ |
| `catalog.category.create/update/move/archive` | ✔ | ✔ | ✔ | ✖ | ✖ |
| `catalog.ai.use` (generar desc/specs/imagen) | ✔ | ✔ | ✔ | ✖ | ✖ |
| Ver **costo proveedor** en respuestas | ✔ | ✔ | ✖ (o restringido) | ✔ | ✖ |

- La autorización crítica vive en el **caso de uso**, no solo en `adminProcedure`
  ([07 §Autorización](../07-auth-identidad.md), [02](../02-arquitectura.md)).
- **Property-level**: el presenter admin nunca incluye `supplier_cost_snapshot_minor` ni margen para
  `CATALOG_MANAGER` (BOPLA, [06 §validación de salida](../06-validaciones.md)).
- Endpoints públicos de lectura: `publicProcedure`, sin auth, solo `PUBLISHED`.

---

## 7. Validaciones

Cuatro capas ([06](../06-validaciones.md)): transporte (Zod) · aplicación (permiso/existencia) · dominio
(invariantes §5) · persistencia (unique/FK/CHECK de [04](../04-modelo-de-datos.md)).

- **Entrada**: todo command/query pasa por schema de `packages/validators/src/catalog.ts` (ejemplos en §3).
- **Normalización antes de persistir**: `trim`; `slugify` controlado; sanitización de HTML en `description`
  (contenido IA enriquecido); bloqueo de claves peligrosas en `attributes`/specs jsonb; longitudes máximas.
- **Salida por presenter tipado**: `ProductAdminResponse` / `ProductDetailResponse` / `ProductCardData` /
  `CategoryResponse`. Nunca fugar `deleted_at`, `supplier_cost_*`, `internal_notes`.
- **Uploads de imagen** (categoría y producto) → validación completa en [12 · Media](./12-modulo-media-storage.md):
  MIME real por magic bytes, allowlist `jpg/png/webp/avif`, tamaño máx, EXIF stripping, 1..6 por producto,
  storage fuera del webroot, URLs firmadas.
- **Ownership / anti-enumeración**: recurso inexistente o no visible (p.ej. producto `DRAFT` pedido por
  público) ⇒ `RESOURCE_NOT_FOUND` (404), nunca 200 ([06 §IDs y ownership](../06-validaciones.md)).

---

## 8. Eventos de dominio

Despachados por `shared/events/event-bus.ts` (in-process) y, para efectos que cruzan el límite transaccional,
por **outbox** ([02 §Event bus y Outbox](../02-arquitectura.md), [04 §shared](../04-modelo-de-datos.md), [32](../32-jobs-y-async.md)).

### 8.1 Emitidos por catálogo

| Evento | Cuándo | Consumidores (efecto) |
|---|---|---|
| `ProductCreated` | alta | audit; (opcional) init de pricing/inventory por variante |
| `ProductUpdated` | edición de contenido | invalidar cache de detalle; re-index parcial |
| `ProductMediaChanged` | set de imágenes | job de thumbnails/blur (§10); re-warm de card |
| `ProductSpecsChanged` | set de specs | re-index de facetas (`value_num`/`unit`) |
| `ProductSlugChanged` / `CategorySlugChanged` | cambio de slug | escribir `slug_history`; invalidar sitemap/301 |
| `ProductPublished` | publish OK | **indexación búsqueda** + warm de `catalog_card_read_model` + invalidar cache público + (futuro) sitemap/IA embeddings |
| `ProductPaused` / `ProductArchived` / `ProductUnpublished` | transición | quitar de índice/cards públicas |
| `VariantAdded` / `VariantUpdated` / `VariantDeactivated` | ABM variante | pricing/inventory reaccionan (init/baja) |
| `CategoryCreated/Updated/Moved/Archived` | ABM categoría | invalidar cache del árbol; re-index de facetas |

### 8.2 Consumidos por catálogo (de otros dominios)

| Evento (origen) | Reacción en catálogo |
|---|---|
| `PriceChanged` ([14](./14-modulo-pricing.md)) | refrescar `price`/`compare_at` en `catalog_card_read_model`; recomputar badge de descuento |
| `StockLevelChanged` / `StockReservationExpired` ([13](./13-modulo-inventario.md)) | recomputar `stockStatus` (IN_STOCK/SOON/OUT_OF_STOCK) del read model |
| `SupplierProductMapped` ([20](./20-modulo-suppliers.md)) | crear/actualizar producto+variante vía los commands de §3 (import con markup) |

> `PriceChanged` es **consumido** (el precio no vive en catálogo). Catálogo solo actualiza su proyección de
> card; la verdad del precio queda en pricing.

---

## 9. Errores tipados → code / HTTP

Códigos base y de negocio en [05 §Catálogo de códigos](../05-convenciones-api.md). Extensión de este módulo:

| Error de dominio | `code` público | HTTP |
|---|---|---|
| Slug de producto en uso | `PRODUCT_SLUG_TAKEN` | 409 (`CONFLICT`) |
| Slug de categoría en uso (mismo parent) | `CATEGORY_SLUG_TAKEN` | 409 |
| SKU en uso | `SKU_TAKEN` | 409 |
| >6 imágenes | `TOO_MANY_IMAGES` | 422 |
| <1 imagen al publicar | `TOO_FEW_IMAGES` | 422 |
| Posición de imagen duplicada | `DUPLICATE_MEDIA_POSITION` | 422 |
| Producto no publicable (faltan requisitos) | `PRODUCT_NOT_PUBLISHABLE` | 422 (`details[]` con faltantes) |
| Transición de estado inválida | `INVALID_PRODUCT_STATE` | 409 |
| Categoría padre inexistente | `CATEGORY_PARENT_NOT_FOUND` | 422 |
| Reparent crea ciclo | `CATEGORY_CYCLE` | 422 |
| Profundidad de árbol excedida | `CATEGORY_DEPTH_EXCEEDED` | 422 |
| Categoría con hijos/productos activos | `CATEGORY_NOT_EMPTY` | 409 |
| Última variante activa | `LAST_ACTIVE_VARIANT` | 409 |
| Categoría/marca/media/variante inexistente | `RESOURCE_NOT_FOUND` | 404 |
| IA no disponible | `UPSTREAM_UNAVAILABLE` | 502/503 (degradación: el admin sigue editando a mano) |

Mensajes públicos claros, no técnicos; jamás exponer SQL/ORM/nombres de tabla
([05](../05-convenciones-api.md), [06](../06-validaciones.md)). En tRPC → `TRPCError` con `cause` interno loggeado.

---

## 10. Jobs (async, [32](../32-jobs-y-async.md))

Productores viven en `apps/api` (outbox); consumers en `apps/workers`. Todo job: idempotente, reintentos con
backoff, DLQ, timeout, logs por `jobId`, trazable al evento origen (skill §19.2).

| Job | Disparado por | Qué hace |
|---|---|---|
| `catalog.reindexProduct` | `ProductPublished`, `ProductUpdated`, `ProductSpecsChanged`, `Product(Un)published/Archived` | actualiza índice de búsqueda (pg_trgm sobre `title` + facetas de specs); mantiene la verdad en PostgreSQL |
| `catalog.generateThumbnails` | `ProductMediaChanged`, `SetCategoryImage`, upload IA | genera thumbnails/tamaños, `blur_placeholder`, `dominant_color`, dimensiones → escribe `media_asset` ([12](./12-modulo-media-storage.md)) |
| `catalog.warmCardReadModel` | `ProductPublished`, `PriceChanged`, `StockLevelChanged` | materializa/refresca `catalog_card_read_model` ([18](./18-modulo-dashboard-analytics.md)) |
| `catalog.rebuildCategoryTreeCache` | `Category*` events | invalida/rehidrata cache del árbol (Redis) |
| `catalog.aiGenerateImage` | `GenerateProductImageCommand` | llama IA async ([17](./17-modulo-ia-gateway.md)), persiste `media_asset source='ai'`, notifica |

Trabajo pesado (imágenes, embeddings) **nunca** en el request path (skill §10.1/§17.2).

---

## 11. Casos borde y decisiones abiertas

- **Multi-categoría**: el pedido dice "adjudicar categoría(s)" (plural), pero [04](../04-modelo-de-datos.md)
  fija `product.category_id` (single FK) + denormalización `category_name`. **Decisión abierta**: ¿se agrega
  tabla `product_category` (N:M) para categorías secundarias? Propuesta: `category_id` = categoría **primaria**
  (breadcrumb/SEO) y, si se necesita cross-listing, agregar `product_category` sin romper el canon. Requiere
  ADR + cambio en 04. **Hasta entonces: single-category.**
- **`ProductCardData` vs canon**: el read model debe reconciliar el shape del front
  ([README §inconsistencias](../README.md), [04](../04-modelo-de-datos.md)): `oldPrice`→`compare_at`,
  `image/imageAlt`→`main_image` + `alt_text`, `category:string`→`category_name` denormalizado,
  `stockStatus`/`shipping`/`rating`/`badge` **derivados**. `badge` puede ser manual (override admin) o derivado
  (`new` por `published_at` reciente, `discount` por `compare_at>price`, `soon`/`stock` por inventory).
- **`brand` obligatoria para publicar**: la policy §5.2 la lista como recomendada. El mock tiene productos con
  categorías tipo "Consolas"/"Microondas" que no están en el árbol declarado de `mock-products.ts`
  (`CATEGORY_TREE` solo cubre Electrónica/Electrodomésticos). **Decisión abierta**: seed debe crear el árbol
  completo (Refrigeradores, Computadoras, Lavadoras, Celulares, Electrodomésticos, Imagen, Aspiradoras, Audio y
  Video, Consolas, Microondas) — coordinar con [04 §Semillas](../04-modelo-de-datos.md).
- **Variantes sin precio propio**: en el mock la card muestra un solo precio; con variantes color/capacity el
  precio puede variar por variante (pricing ancla en `variant_id`). El detalle debe exponer rango o precio de
  la variante seleccionada. Reconciliar en [14](./14-modulo-pricing.md).
- **Slug histórico ilimitado**: `product_slug_history` puede crecer; definir retención/limpieza (¿job?).
- **Idempotencia de commands de escritura**: los ABM de catálogo no son operaciones "de dinero", pero
  `PublishProduct` y generación IA (costo) podrían aceptar `Idempotency-Key` para evitar dobles clicks/costos
  duplicados. **Decisión abierta** (probablemente sí para IA por costo, ver [17](./17-modulo-ia-gateway.md)).
- **Reviews/rating**: hoy en el mock son estáticos; el read model debe tolerar su ausencia (rating `null`)
  hasta que exista el dominio de reviews.

---

## 12. Definition of Done

Alineado con skill §28 y checklist de endpoint de [05](../05-convenciones-api.md). El módulo catálogo está
"Done" cuando:

```txt
[ ] Toda regla (publicación, cardinalidad de media, árbol de categorías) vive en domain/application,
    no en el router tRPC/REST.
[ ] Todos los commands/queries tienen schema Zod en packages/validators (compartido con el front).
[ ] Todos los errores esperados son tipados y mapean a code/HTTP (§9).
[ ] CanPublishProductPolicy testeada (unit) con todos los faltantes; GetPublishChecklist refleja la policy.
[ ] Tests de autorización negativa: CATALOG_MANAGER no ve costo; público no ve DRAFT (404); FINANCE no publica.
[ ] Invariantes 1..6 imágenes y árbol sin ciclos testeadas (dominio + constraint DB).
[ ] Read model de card reconcilia ProductCardData (precio/stock derivados, sin persistir en product).
[ ] Redirect 301 por slug histórico verificado en GET público.
[ ] Endpoints públicos en OpenAPI; procedimientos tRPC tipados; presenters sin campos internos.
[ ] Eventos ProductPublished/PriceChanged(consumido) emitidos/consumidos y cubiertos por jobs (§10).
[ ] Jobs de reindex/thumbnails idempotentes, con reintentos y DLQ.
[ ] Migraciones corren desde cero; seed replica el catálogo del mock (categorías + productos demo).
[ ] Logs con requestId sin PII; métricas de latencia de search/detalle (skill §16).
[ ] Smoke test en staging: crear categoría → crear producto → subir 1..6 imágenes → specs → variante →
    publicar → aparece en GET público → editar slug → 301 al viejo.
```
