# 14 · Módulo Pricing (dominio `pricing`)

> Diseño del dominio que **calcula el precio de venta** de cada variante a partir del **costo del
> proveedor** más una **regla de markup auditable**, y que sirve de **base del margen** ("cuánto se
> invirtió"). No es implementación: fija entidades, casos de uso, endpoints, invariantes, permisos,
> validaciones, eventos, errores y ejemplos numéricos. Respeta el canon de
> [04-modelo-de-datos](../04-modelo-de-datos.md), [05-convenciones-api](../05-convenciones-api.md),
> [06-validaciones](../06-validaciones.md), [07-auth-identidad](../07-auth-identidad.md) y
> [03-stack-y-decisiones](../03-stack-y-decisiones.md) (ADR-007 dinero).

---

## 1. Propósito y alcance

### 1.1 Por qué existe

CloudCommerce es **dropshipping**: el dueño no fabrica ni almacena, **importa productos de proveedores a
un costo** y los **revende con un markup**. El precio de venta **no es un dato que el dueño teclea a mano
en cada producto** (aunque puede): es el **resultado determinístico** de:

```
precio_venta = f(supplier_cost, markup_rule, min_margin_pct)   // o precio manual explícito
margen       = precio_venta − supplier_cost
```

De ese margen dependen dos cosas que el dueño pidió explícitamente:

- **Finanzas** ([16-modulo-finanzas](./16-modulo-finanzas.md)): ingresos, costos y márgenes reales.
- El KPI del cliente **"cuánto invirtió"** ([11-modulo-clientes](./11-modulo-clientes.md)): cuánto costó
  (al dueño) lo que ese cliente compró = suma de `supplier_cost_snapshot_minor` de sus líneas.

Por eso el pricing es **negocio crítico**: si el precio o el costo son incorrectos, las finanzas mienten.

### 1.2 Responsabilidades (in scope)

```txt
- Registrar el costo del proveedor por variante (supplier_cost) con vigencias.
- Definir reglas de markup (markup_rule) por scope: global / categoría / producto.
- Calcular el precio de venta de una variante de forma DETERMINÍSTICA y AUDITABLE.
- Permitir precio MANUAL (override) respetando min_margin_pct.
- Gestionar compare_at (precio tachado) para ofertas.
- Gestionar descuentos (discount) percent/fixed, con código opcional, vigencias y max_uses.
- Exponer un ComputePrice service que consumen catalog (cards) y orders/checkout (totales).
- Emitir PriceChanged para auditoría e invalidación de caches / read models.
```

### 1.3 Fuera de alcance (out of scope)

```txt
- Cálculo de impuestos/IVA de la orden → orders/finanzas (pricing entrega neto; tax_minor lo pone orders).
- Costo de envío (shipping_minor) → orders/shipping.
- Optimización de precios con IA (sugerencias de margen/competencia) → 17-modulo-ia-gateway (solo sugiere;
  el precio final SIEMPRE pasa por este dominio y sus invariantes).
- Persistencia del snapshot de costo/precio en la orden → orders (order_line.*_snapshot_minor).
  Pricing PROVEE los valores; orders los CONGELA.
- Numeración/documentos comerciales → finanzas.
```

### 1.4 Relación con otros dominios

```txt
suppliers  → provee supplier_cost (feed importa costo; ver 20-modulo-suppliers)
inventory  → variante vendible (available > 0); pricing no decide stock, pero el precio de una variante
             sin stock no se muestra como comprable
catalog    → consume ComputePrice para cards / detalle (precio, compare_at, badge de oferta)
orders     → consume ComputePrice en carrito/checkout para recalcular totales y CONGELA snapshots
finance    → consume margen (precio_venta − supplier_cost) para revenue/cost/margin
customers  → KPI "cuánto invirtió" = Σ supplier_cost_snapshot_minor de las órdenes del cliente
```

---

## 2. Entidades y tablas (canon [04](../04-modelo-de-datos.md) §pricing)

El esquema canónico ya está fijado en [04](../04-modelo-de-datos.md). Aquí se detalla su semántica,
constraints e índices. DDL **ilustrativo** (Drizzle vive en `packages/database/src/schema/pricing.ts`).

### 2.1 `price` — precio publicado por lista

Precio efectivo de una variante en una lista, con vigencia. Es el **resultado materializado** de un
cálculo o de un override manual; permite tener múltiples listas (p. ej. `DEFAULT` de venta, `PVP` para
tachado).

```
price   id, variant_id(FK), list_id(FK), amount_minor, currency,
        valid_from, valid_to?, created_by, created_at
```

```txt
- amount_minor: entero en unidad menor (centavos ARS). NUNCA float (ADR-007).
- currency: debe coincidir con price_list.currency y con supplier_cost.currency de la variante.
- valid_from/valid_to?: vigencia. NULL valid_to = vigente indefinido. No solapar dos price ACTIVOS
  de la misma (variant_id, list_id) en el tiempo.
- created_by: admin_user_id (o 'system' si lo generó recálculo por regla).
- origin (recomendado agregar como columna enum): COMPUTED | MANUAL — para auditar de dónde salió.
```

CHECK / índices ilustrativos:

```sql
CHECK (amount_minor >= 0)
CHECK (valid_to IS NULL OR valid_to > valid_from)
CREATE UNIQUE INDEX uq_price_variant_list_active
  ON price(variant_id, list_id) WHERE valid_to IS NULL;   -- un vigente-abierto por (variant,list)
CREATE INDEX idx_price_variant_list_from ON price(variant_id, list_id, valid_from DESC);
```

### 2.2 `price_list` — listas de precio

```
price_list   id, name, is_default, currency
```

```txt
- name: 'DEFAULT' (precio de venta), 'PVP' (sugerido → compare_at), a futuro 'MAYORISTA', etc.
- is_default: exactamente UNA lista default por moneda (invariante).
- currency: ARS base (ADR-007). Una lista no mezcla monedas.
```

```sql
CREATE UNIQUE INDEX uq_price_list_default_per_currency
  ON price_list(currency) WHERE is_default;
```

### 2.3 `supplier_cost` — costo del proveedor (base del margen)

**El dato más sensible del dominio.** Cuánto le cuesta al dueño la variante. Fuente del margen y del
"cuánto invirtió". Solo visible para OWNER/ADMIN/FINANCE (ver §6).

```
supplier_cost   id, variant_id(FK), supplier_id(FK), cost_amount_minor, currency,
                valid_from, valid_to?, created_at
```

```txt
- Un mismo variant_id puede tener costos de varios proveedores (multi-sourcing); el costo VIGENTE
  activo se elige por política: proveedor preferido de la variante, o menor costo, o el más reciente.
  Política por defecto: proveedor marcado como preferido; fallback al costo vigente más reciente.
- Historial: cambios de costo NO se editan in place → se cierra el vigente (valid_to = now) y se
  inserta uno nuevo. Así el margen histórico de órdenes viejas es reconstruible.
- currency debe coincidir con la moneda de la lista de venta de esa variante (sin conversión implícita).
```

```sql
CHECK (cost_amount_minor >= 0)
CHECK (valid_to IS NULL OR valid_to > valid_from)
CREATE INDEX idx_supplier_cost_variant_from
  ON supplier_cost(variant_id, valid_from DESC);
CREATE UNIQUE INDEX uq_supplier_cost_variant_supplier_active
  ON supplier_cost(variant_id, supplier_id) WHERE valid_to IS NULL;
```

### 2.4 `markup_rule` — regla de markup

Cómo se transforma el costo en precio. Por scope, con precedencia.

```
markup_rule   id, scope(global/category/product), scope_id?, kind(percent/fixed),
              value, min_margin_pct?, is_active, created_by, created_at
```

```txt
- scope: GLOBAL (scope_id NULL) | CATEGORY (scope_id = category_id) | PRODUCT (scope_id = product_id).
- kind: PERCENT → precio = costo * (1 + value/100).   FIXED → precio = costo + value (value en minor).
- value: percent → entero de basis-safe (ver §5.4, se recomienda basis points o 2 decimales fijos);
  fixed → amount_minor.
- min_margin_pct?: piso de margen relativo. Si el precio calculado deja margen < min_margin_pct,
  se eleva el precio hasta cumplirlo (o se rechaza el manual). Ver §5.
- Precedencia (más específico gana): PRODUCT > CATEGORY > GLOBAL. Debe existir SIEMPRE una GLOBAL
  activa (regla de arranque) para que ninguna variante quede sin política.
- is_active: solo una regla activa por (scope, scope_id). Cambiar regla = desactivar + crear (auditable).
```

```sql
CHECK (kind IN ('percent','fixed'))
CHECK (scope IN ('global','category','product'))
CHECK ((scope = 'global') = (scope_id IS NULL))
CREATE UNIQUE INDEX uq_markup_rule_scope_active
  ON markup_rule(scope, scope_id) WHERE is_active;
```

### 2.5 `discount` — descuentos

```
discount   id, code?, kind(percent/fixed), value, scope, scope_id?,
           valid_from, valid_to?, max_uses?, used_count, is_active
```

```txt
- code?: NULL = descuento automático (aplica por scope sin código); no-NULL = cupón que el cliente ingresa.
- kind/value: percent (sobre el precio de venta) o fixed (amount_minor a restar).
- scope/scope_id: GLOBAL | CATEGORY(category_id) | PRODUCT(product_id). (VARIANTE si se necesitara granularidad.)
- valid_from/valid_to?: ventana de vigencia.
- max_uses? / used_count: tope de canje global; used_count se incrementa transaccionalmente al aplicar.
- is_active: apagado manual sin borrar (auditoría).
- Descuento NUNCA puede violar min_margin_pct → si lo violaría, se topa el descuento (o se rechaza si es cupón).
```

```sql
CHECK (kind IN ('percent','fixed'))
CHECK (value >= 0)
CHECK (max_uses IS NULL OR used_count <= max_uses)
CREATE UNIQUE INDEX uq_discount_code ON discount(lower(code)) WHERE code IS NOT NULL;
CREATE INDEX idx_discount_scope_active ON discount(scope, scope_id) WHERE is_active;
```

### 2.6 `compare_at` (precio tachado)

No es tabla propia: es una **derivación**. El `compare_at_amount_minor` del producto/variante
(reconciliación en [04](../04-modelo-de-datos.md) §Product) sale de:

```txt
1. El price VIGENTE de la lista 'PVP' (precio sugerido/ancla), si existe y es > precio de venta; o
2. El price INMEDIATAMENTE ANTERIOR de la lista DEFAULT (precio previo antes de una baja), si es > actual.
```

Regla de honestidad comercial (invariante §5.6): **compare_at solo se muestra si es estrictamente mayor
que el precio de venta vigente**. No se inventan tachados.

### 2.7 Tipos de dominio (ilustrativos)

```ts
// packages/types — dinero canónico (ADR-007 / 04 §Convenciones)
export type Currency = 'ARS' | 'USD';
export type Money = { amountMinor: number; currency: Currency };

// Resultado del cálculo — trazable de punta a punta
export type PriceBreakdown = {
  variantId: string;
  currency: Currency;
  supplierCost: Money;            // base del margen (interno; presenter lo oculta a roles sin permiso)
  appliedRule: { id: string; scope: 'global'|'category'|'product'; kind: 'percent'|'fixed'; value: number } | null;
  basePrice: Money;              // costo + markup (o manual), antes de descuentos
  compareAt: Money | null;       // precio tachado (o null)
  appliedDiscount: { id: string; code: string | null; kind: 'percent'|'fixed'; value: number; amount: Money } | null;
  salePrice: Money;              // precio final de venta que ve/paga el cliente
  marginMinor: number;           // salePrice - supplierCost (interno)
  marginPct: number;             // marginMinor / salePrice * 100 (interno)
  computedAt: string;            // ISO; determinístico dado (costo, regla, descuento, fecha)
  origin: 'COMPUTED' | 'MANUAL';
};
```

---

## 3. Casos de uso (application layer)

Convención: cada caso de uso declara **actor, input (Zod), permiso, transacción, eventos, salida,
errores** (skill §3.4). Los comandos viven en `modules/pricing/application/commands`, las queries en
`.../queries`. La autorización crítica vive en el caso de uso, no solo en el `adminProcedure`
([07](../07-auth-identidad.md)).

### 3.1 `SetManualPrice` (command)

Fija un precio manual (override) para una variante en una lista.

```txt
Actor:     admin { OWNER | ADMIN } (CATALOG_MANAGER: ver §6 — restringido/deshabilitado)
Input:     { variantId, listId?, amountMinor, currency, validFrom?, note? }   (Zod SetManualPriceSchema)
Permiso:   pricing.setManualPrice  (RBAC)  +  la variante existe y no está ARCHIVED (ABAC)
Tx:        SÍ. (a) leer supplier_cost vigente de la variante; (b) validar min_margin_pct de la regla
           aplicable; (c) cerrar price vigente (valid_to = validFrom); (d) insertar price nuevo
           origin=MANUAL; (e) escribir outbox PriceChanged; (f) audit_log(before/after).
Eventos:   PriceChanged (§8)
Salida:    PriceBreakdown (presenter oculta costo/margen si el rol no tiene permiso)
Errores:   RESOURCE_NOT_FOUND (variante/lista), VALIDATION_FAILED (monto<0, moneda),
           MARGIN_BELOW_MINIMUM (422) si amountMinor deja margen < min_margin_pct,
           NO_SUPPLIER_COST (422) si no hay costo cargado y la política exige validar margen,
           CURRENCY_MISMATCH (422), FORBIDDEN (403).
```

### 3.2 `SetMarkupRule` (command)

Crea/reemplaza la regla de markup de un scope.

```txt
Actor:     admin { OWNER | ADMIN }  (pricing global/markup: NUNCA CATALOG_MANAGER — matriz 07)
Input:     { scope, scopeId?, kind, value, minMarginPct?, isActive? }        (Zod SetMarkupRuleSchema)
Permiso:   pricing.setMarkupRule  +  (scope=global exige OWNER/ADMIN)  +  coherencia scope/scopeId
Tx:        SÍ. (a) validar que scope_id existe (category/product) o es NULL (global);
           (b) desactivar regla activa previa del mismo (scope, scope_id); (c) insertar nueva is_active;
           (d) encolar job RecomputeAffectedPrices(scope, scopeId) — recálculo async de precios COMPUTED
               afectados (no de los MANUAL); (e) audit_log.
Eventos:   MarkupRuleChanged (interno) → dispara PriceChanged por cada variante recalculada.
Salida:    { ruleId, affectedVariantsEstimate }
Errores:   VALIDATION_FAILED (value fuera de rango, percent negativo), RESOURCE_NOT_FOUND (scopeId),
           CONFLICT (ya existe regla activa idéntica), FORBIDDEN.
Nota:      recálculo masivo va por cola (ADR-006); el request no bloquea. Precios MANUAL se respetan
           salvo que violen el nuevo min_margin_pct → se listan para revisión (no se pisan silenciosamente).
```

### 3.3 `ComputeSalePrice` (query — núcleo del dominio)

Función pura + lecturas: calcula el precio de venta de una variante en una fecha. **Determinística**:
mismas entradas (costo, regla, descuento, fecha) → misma salida.

```txt
Actor:     public (store card) | admin | system (checkout, jobs)
Input:     { variantId, at?: ISODate = now, listId? = DEFAULT, discountCode?, includeInternal?: bool }
Permiso:   público para salePrice/compareAt; supplierCost/margin SOLO si actor tiene pricing.viewCost.
Tx:        NO (read-only). Puede cachearse (§ orders/catalog): key = (variantId, listId, day, ruleVersion,
           discountVersion). Invalidada por PriceChanged.
Lógica:    1) costo = supplier_cost vigente(variantId, at) según política de sourcing.
           2) regla = markup_rule más específica activa (product > category > global).
           3) si existe price MANUAL vigente en la lista → basePrice = ese price (origin=MANUAL);
              si no → basePrice = aplicar(regla, costo)  (origin=COMPUTED).
           4) aplicar min_margin_pct (elevar basePrice si hace falta — §5.2).
           5) compareAt = derivar (§2.6).
           6) discount = resolver(scope, code, at) → aplicar sobre basePrice sin violar min_margin (§5.5).
           7) salePrice = basePrice − descuento (redondeo determinístico §5.4).
           8) margin = salePrice − costo ; marginPct.
Salida:    PriceBreakdown (presenter recorta internos según permiso).
Errores:   RESOURCE_NOT_FOUND (variante), NO_SUPPLIER_COST (422 si no hay costo y no hay price manual),
           NO_ACTIVE_MARKUP_RULE (422, no debería pasar: siempre hay GLOBAL), DISCOUNT_INVALID (422).
```

### 3.4 `CreateDiscount` (command)

```txt
Actor:     admin { OWNER | ADMIN }  (FINANCE: no; CATALOG_MANAGER: no por defecto)
Input:     { code?, kind, value, scope, scopeId?, validFrom, validTo?, maxUses? }  (Zod CreateDiscountSchema)
Permiso:   pricing.createDiscount  +  coherencia scope/scopeId
Tx:        SÍ. insertar discount is_active, used_count=0. audit_log.
Eventos:   DiscountCreated (interno; puede invalidar cache de precios del scope).
Salida:    { discountId, code? }
Errores:   VALIDATION_FAILED, CONFLICT (código duplicado, case-insensitive), RESOURCE_NOT_FOUND (scopeId),
           FORBIDDEN.
```

### 3.5 `ApplyDiscount` (command — invocado desde checkout)

Consumo real de un descuento al confirmar (incrementa `used_count`).

```txt
Actor:     system (checkout) | admin (venta asistida channel=admin_manual)
Input:     { orderId, variantId(s) o cartId, discountCode?, at }
Permiso:   interno; el checkout ya autenticó al comprador/actor.
Tx:        SÍ (parte de la transacción de checkout — 15-modulo-ordenes).
           (a) resolver discount vigente y con cupo (used_count < max_uses) FOR UPDATE;
           (b) recomputar precio con descuento (ComputeSalePrice) — el backend NO confía en el precio
               que trae el cliente; (c) incrementar used_count; (d) el monto de descuento se refleja en
               order.discount_minor y en las líneas; (e) audit.
Eventos:   DiscountApplied (interno). PriceChanged NO (el precio de lista no cambia; cambia el total de la orden).
Salida:    { discountId, amountMinor } para que orders arme totales.
Errores:   DISCOUNT_INVALID (422: expirado/inactivo), DISCOUNT_EXHAUSTED (409: sin cupo),
           MARGIN_BELOW_MINIMUM (422 si el cupón hundiría el margen — se rechaza el cupón, no la orden),
           PRICE_CHANGED (409: el precio base cambió respecto de lo que el cliente veía — ver §9).
```

### 3.6 `GetPriceForVariant` (query — para catalog cards / detalle)

Fachada liviana de `ComputeSalePrice` optimizada para render público (sin internos).

```txt
Actor:     public | admin
Input:     { variantId | variantIds[] (batch para cards), at?, listId? }
Permiso:   público (solo salePrice, compareAt, isOnSale, currency).
Tx:        NO. Batch para evitar N+1 en grillas de catálogo. Se sirve desde read model / cache.
Salida:    { variantId, salePrice: Money, compareAt: Money|null, isOnSale: bool, currency }[]
           (SIN supplierCost, SIN margin — presenter público).
Errores:   entradas inválidas → VALIDATION_FAILED; variantes inexistentes se omiten (no 404 en batch).
```

> `GetPriceForVariant` es la puerta que **catalog** usa para pintar precio en las cards
> ([04](../04-modelo-de-datos.md): `price`, `compare_at` NO se persisten en `product`, se derivan aquí).

---

## 4. Endpoints tRPC `pricing.*` (admin) + consumo interno

Namespace `pricing` del `appRouter` ([05](../05-convenciones-api.md) §Convención tRPC). Todos los de
gestión son `adminProcedure`; el de lectura pública se expone vía catalog.

```txt
# Costos (SOLO OWNER/ADMIN/FINANCE — dato sensible)
pricing.getSupplierCost({ variantId })                    query   → costo vigente + historial
pricing.setSupplierCost({ variantId, supplierId, costAmountMinor, currency, validFrom? })  mutation
pricing.listSupplierCosts({ variantId })                  query   → historial de costos

# Markup
pricing.getMarkupRule({ scope, scopeId? })                query
pricing.setMarkupRule(SetMarkupRuleSchema)                mutation  → §3.2
pricing.listMarkupRules({ scope? })                       query

# Precios
pricing.setManualPrice(SetManualPriceSchema)              mutation  → §3.1
pricing.computeSalePrice({ variantId, at?, listId?, discountCode?, includeInternal? })  query → §3.3
pricing.previewPrice(SetMarkupRuleSchema | SetManualPriceSchema)  query  → simulación sin persistir
pricing.getPriceHistory({ variantId, listId? })           query   → auditoría de cambios (PriceChanged)

# Descuentos
pricing.createDiscount(CreateDiscountSchema)              mutation  → §3.4
pricing.updateDiscount({ discountId, patch })             mutation
pricing.deactivateDiscount({ discountId })                mutation
pricing.listDiscounts({ scope?, activeOnly? })            query
pricing.validateDiscount({ code, variantId, at? })        query   → sin consumir cupo (preview)

# Price lists
pricing.listPriceLists()                                  query
pricing.upsertPriceList({ name, isDefault, currency })    mutation  (OWNER/ADMIN)
```

Consumo interno (no tRPC público, sino puerto de aplicación):

```txt
PricingPort.computeSalePrice(...)     ← catalog (cards/detalle), orders (carrito/checkout)
PricingPort.applyDiscount(...)        ← checkout (dentro de la tx de orden)
PricingPort.snapshotForOrderLine(...) ← orders congela { unit_price_minor, supplier_cost_snapshot_minor }
```

REST/OpenAPI: pricing es **admin-interno**, no se expone REST público salvo lo que catalog ya expone
(`GET /api/v1/catalog/products/:id` ya incluye precio derivado). Idempotencia
([05](../05-convenciones-api.md)) aplica a mutaciones con efecto (setSupplierCost, createDiscount) vía
`Idempotency-Key` cuando se invoquen desde import de feeds en lote.

---

## 5. Reglas e invariantes

### 5.1 El cliente nunca envía el precio (regla de oro)

El frontend **muestra**, no decide ([06](../06-validaciones.md) §Dinero, skill §4.5/§6.5). En
carrito/checkout el backend **recalcula** con `ComputeSalePrice`. `cart_item.unit_price_snapshot_minor`
es solo una foto para UI; **la verdad se recomputa** al confirmar. Si difiere → `PRICE_CHANGED` (§9).

### 5.2 Piso de margen (`min_margin_pct`) es irrompible

```txt
margin_pct = (salePrice − supplierCost) / salePrice * 100
Invariante: margin_pct >= min_margin_pct (de la regla aplicable), SIEMPRE.
- COMPUTED: si el markup no alcanza el piso, se ELEVA el precio hasta cumplirlo.
- MANUAL:   si el override lo viola → MARGIN_BELOW_MINIMUM (no se guarda).
- DESCUENTO: se topa para no violar el piso (auto) o se rechaza (cupón).
```

Esto protege el negocio: nunca se vende por debajo del margen mínimo definido por el dueño.

### 5.3 Precedencia de reglas determinística

`PRODUCT > CATEGORY > GLOBAL`. Siempre existe una regla GLOBAL activa (arranque). Empates imposibles por
`uq_markup_rule_scope_active`. El breakdown incluye `appliedRule.id` → **auditable**: siempre se sabe qué
regla produjo el precio.

### 5.4 Redondeo determinístico

```txt
- Todo en enteros minor (centavos ARS). NUNCA float (ADR-007).
- percent: para evitar pérdida, value se maneja con precisión fija (recomendado: basis points, 1% = 100 bp)
  y el cálculo se hace en entero:  precio = floor( costo * (10000 + valueBp) / 10000 )  con regla de
  redondeo HALF_UP explícita y ÚNICA en todo el sistema (helper compartido en shared/money).
- El redondeo se aplica UNA vez, al final (después de markup, antes/después de descuento según orden fijo:
  markup → min_margin → descuento → redondeo final).
- Mismo input ⇒ mismo output (testeable). Sin locale, sin Date.now() dentro del cálculo puro (la fecha
  es un parámetro `at`).
```

### 5.5 Orden de aplicación de descuentos

```txt
basePrice (costo+markup o manual, ya con min_margin aplicado)
  → descuento de scope más específico primero (product > category > global)
  → un solo descuento automático por scope + a lo sumo un cupón (no se apilan sin política explícita)
  → clamp por min_margin_pct
  → redondeo final
```

### 5.6 `compare_at` honesto

`compare_at` se muestra **solo si > salePrice**. Nunca tachado falso. Deriva de PVP o precio previo (§2.6).

### 5.7 Moneda única por cálculo

No hay conversión implícita. `supplier_cost.currency`, `price.currency` y `price_list.currency` de una
variante deben coincidir. Mezcla → `CURRENCY_MISMATCH` (§9 / §11).

### 5.8 Inmutabilidad histórica

Costos y precios **no se editan in place**: se cierran (valid_to) y se re-crean. Las órdenes ya
congelaron su snapshot; el historial permite reconstruir cualquier margen pasado.

---

## 6. Permisos (matriz [07](../07-auth-identidad.md))

El **costo del proveedor y el margen son datos sensibles**. Extracto aplicado a pricing:

| Acción | OWNER | ADMIN | CATALOG_MANAGER | FINANCE | SUPPORT |
|---|:--:|:--:|:--:|:--:|:--:|
| Ver costo proveedor (`supplier_cost`) | ✔ | ✔ | ✖ (o restringido) | ✔ | ✖ |
| Ver margen / "cuánto invirtió" | ✔ | ✔ | ✖ | ✔ | ✖ |
| Set costo proveedor | ✔ | ✔ | ✖ | ✔ | ✖ |
| Editar markup **global** | ✔ | ✔ | ✖ | ✖ | ✖ |
| Editar markup categoría/producto | ✔ | ✔ | restringido* | ✖ | ✖ |
| Set precio manual | ✔ | ✔ | restringido* | ✖ | ✖ |
| Crear/editar descuento | ✔ | ✔ | ✖ | ✖ | ✖ |
| Ver `salePrice`/`compare_at` (público) | ✔ | ✔ | ✔ | ✔ | ✔ |

```txt
* "restringido" (CATALOG_MANAGER): a definir por feature flag. Por defecto NO puede tocar pricing
  (07 dice: "no ve finanzas ni datos sensibles de clientes"; markup/costo caen en esa categoría).
  Si el dueño lo habilita, CATALOG_MANAGER podría fijar precio manual PERO:
   - nunca ve supplier_cost ni margin (presenter los recorta);
   - el backend igual valida min_margin_pct usando el costo (que el rol no ve) → si viola, error genérico
     PRICE_POLICY_VIOLATION sin revelar el costo.
```

Regla de presenter ([06](../06-validaciones.md) §salida): el `PriceBreakdown` **nunca** filtra
`supplierCost`, `marginMinor`, `marginPct` a un actor sin `pricing.viewCost`. Público recibe solo
`salePrice`, `compareAt`, `isOnSale`, `currency`.

Acceso a costo/margen por roles con permiso queda en `access_log` cuando aplique motivo
([07](../07-auth-identidad.md) §motivos).

---

## 7. Validaciones ([06](../06-validaciones.md))

Schemas Zod en `packages/validators/src/pricing.ts` (compartidos front/back). Ilustrativo:

```ts
export const MoneyAmountSchema = z.number().int().nonnegative();  // minor units, entero
export const CurrencySchema    = z.enum(['ARS', 'USD']);

export const SetSupplierCostSchema = z.object({
  variantId:       z.string().uuid(),
  supplierId:      z.string().uuid(),
  costAmountMinor: MoneyAmountSchema,
  currency:        CurrencySchema.default('ARS'),
  validFrom:       z.string().datetime().optional(),
});

export const SetMarkupRuleSchema = z.object({
  scope:        z.enum(['global', 'category', 'product']),
  scopeId:      z.string().uuid().optional(),
  kind:         z.enum(['percent', 'fixed']),
  value:        z.number().int().nonnegative(),      // percent en basis points | fixed en minor
  minMarginPct: z.number().min(0).max(95).optional(),
  isActive:     z.boolean().default(true),
}).refine(v => (v.scope === 'global') === (v.scopeId === undefined),
          { message: 'scopeId requerido salvo scope global', path: ['scopeId'] });

export const SetManualPriceSchema = z.object({
  variantId:   z.string().uuid(),
  listId:      z.string().uuid().optional(),   // default = lista DEFAULT
  amountMinor: MoneyAmountSchema.refine(n => n > 0, 'precio > 0'),
  currency:    CurrencySchema.default('ARS'),
  validFrom:   z.string().datetime().optional(),
  note:        z.string().max(300).optional(),
});

export const CreateDiscountSchema = z.object({
  code:      z.string().trim().min(3).max(40).regex(/^[A-Z0-9_-]+$/i).optional(),
  kind:      z.enum(['percent', 'fixed']),
  value:     z.number().int().nonnegative(),   // percent bp | fixed minor
  scope:     z.enum(['global', 'category', 'product']),
  scopeId:   z.string().uuid().optional(),
  validFrom: z.string().datetime(),
  validTo:   z.string().datetime().optional(),
  maxUses:   z.number().int().positive().optional(),
}).refine(v => !v.validTo || v.validTo > v.validFrom, { message: 'validTo > validFrom', path: ['validTo'] })
  .refine(v => v.kind !== 'percent' || v.value <= 10000, { message: 'percent <= 100%', path: ['value'] });
```

Las 4 capas ([06](../06-validaciones.md)): transporte (Zod arriba) · aplicación (permiso + existencia
variante/scope) · dominio (min_margin, moneda única, no solapamiento de vigencias) · persistencia
(CHECK/UNIQUE del §2). Nunca `req.body` directo al ORM (mass assignment prohibido). Normalización: `code`
a upper, montos ya enteros minor.

---

## 8. Eventos

Dominio events vía outbox ([04](../04-modelo-de-datos.md) §outbox, skill §11.7). El principal:

### 8.1 `PriceChanged`

```ts
type PriceChanged = {
  eventType: 'pricing.PriceChanged';
  variantId: string;
  listId: string;
  previous: { amountMinor: number; currency: Currency } | null;
  current:  { amountMinor: number; currency: Currency };
  origin: 'COMPUTED' | 'MANUAL';
  cause: 'manual_override' | 'markup_rule_changed' | 'supplier_cost_changed' | 'discount_scope_changed';
  actorId: string;   // admin_user_id o 'system'
  occurredAt: string;
};
```

Consumidores:

```txt
- catalog / search: invalidar read model de card (precio, compare_at, badge oferta).
- cache de precios: invalidar keys (variantId, listId, *).
- finance: recomputar snapshots de período si aplica (16-modulo-finanzas).
- audit_log: registrar before/after (parte de la misma tx que originó el cambio).
- (NO altera órdenes existentes: sus snapshots son inmutables.)
```

### 8.2 Otros eventos internos

```txt
MarkupRuleChanged   → dispara RecomputeAffectedPrices (job) → N×PriceChanged
SupplierCostChanged → dispara RecomputeAffectedPrices para variantes COMPUTED de ese proveedor
DiscountCreated / DiscountApplied → invalidación de cache de scope / métricas de canje
```

---

## 9. Errores ([05](../05-convenciones-api.md) §códigos)

| code | HTTP | Cuándo |
|------|------|--------|
| `PRICE_CHANGED` | **409** | El precio recomputado en checkout difiere del que vio el cliente (o del snapshot del carrito). El cliente debe reconfirmar el nuevo total. |
| `MARGIN_BELOW_MINIMUM` | 422 | Precio manual o descuento que dejaría margen < `min_margin_pct`. |
| `NO_SUPPLIER_COST` | 422 | Se pide calcular/validar margen y no hay costo cargado ni precio manual. |
| `CURRENCY_MISMATCH` | 422 | Moneda de costo/lista/precio no coincide. |
| `DISCOUNT_INVALID` | 422 | Cupón inexistente, inactivo o fuera de vigencia. |
| `DISCOUNT_EXHAUSTED` | 409 | `used_count >= max_uses`. |
| `NO_ACTIVE_MARKUP_RULE` | 422 | No hay regla activa (no debería ocurrir: siempre hay GLOBAL). |
| `PRICE_POLICY_VIOLATION` | 422 | Genérico para roles sin permiso de ver costo (no revela el costo). |
| `VALIDATION_FAILED` | 400 | Falla de schema Zod. |
| `FORBIDDEN` | 403 | Autenticado sin permiso (p. ej. CATALOG_MANAGER a markup global). |
| `RESOURCE_NOT_FOUND` | 404 | Variante / lista / scope inexistente. |

`PRICE_CHANGED` es el error de negocio central del dominio en el flujo de compra: garantiza que el cliente
paga el precio real, no uno viejo. Mensajes públicos claros, sin costos ni SQL
([05](../05-convenciones-api.md)).

---

## 10. Ejemplos numéricos (ARS, minor = centavos)

Notación: `$X` = pesos; minor = centavos (`$100 = 10000`). Percent en basis points (`50% = 5000 bp`).

### 10.1 Markup percent

```txt
supplier_cost = $12.000  → 1.200.000 minor
markup_rule   = PERCENT 50% (5000 bp), scope=CATEGORY, min_margin_pct = 25
basePrice = floor(1.200.000 * (10000 + 5000) / 10000) = floor(1.800.000) = 1.800.000 minor = $18.000
margen    = 1.800.000 − 1.200.000 = 600.000 minor = $6.000
margin_pct = 600.000 / 1.800.000 = 33,33%  ≥ 25  ✔  (no se eleva)
salePrice = $18.000
```

### 10.2 Markup fixed

```txt
supplier_cost = $12.000 (1.200.000)
markup_rule   = FIXED +$5.000 (500.000 minor), min_margin_pct = 25
basePrice = 1.200.000 + 500.000 = 1.700.000 = $17.000
margin_pct = 500.000 / 1.700.000 = 29,41%  ≥ 25  ✔
salePrice = $17.000
```

### 10.3 min_margin eleva el precio (markup insuficiente)

```txt
supplier_cost = $12.000 (1.200.000)
markup_rule   = PERCENT 10% (1000 bp), min_margin_pct = 25
basePrice_tentativo = floor(1.200.000 * 11000/10000) = 1.320.000 = $13.200
margin_pct = 120.000/1.320.000 = 9,09% < 25  → NO cumple
→ elevar hasta margin_pct = 25:  salePrice = costo / (1 − 0,25) = 1.200.000 / 0,75 = 1.600.000 = $16.000
verif: margin = 400.000 ; 400.000/1.600.000 = 25,00%  ✔
```

### 10.4 Precio manual válido vs. inválido

```txt
supplier_cost = $12.000, min_margin_pct(regla aplicable) = 25
Manual $20.000 (2.000.000): margin_pct = 800.000/2.000.000 = 40% ≥ 25 → OK, price origin=MANUAL.
Manual $14.000 (1.400.000): margin_pct = 200.000/1.400.000 = 14,3% < 25 → MARGIN_BELOW_MINIMUM (422).
```

### 10.5 Descuento con clamp por margen

```txt
basePrice = $18.000 (1.800.000), supplier_cost = $12.000, min_margin_pct = 25
Descuento PERCENT 20% (2000 bp):
  tentativo = floor(1.800.000 * 8000/10000) = 1.440.000 = $14.400
  margin_pct = 240.000/1.440.000 = 16,7% < 25 → clamp
  precio mínimo por margen = 1.200.000/0,75 = 1.600.000 = $16.000
  salePrice (auto) = $16.000  (descuento efectivo topado a $2.000, no $3.600)
  Si fuese CUPÓN explícito y la política es "no topar cupón": DISCOUNT rechazado → MARGIN_BELOW_MINIMUM.
```

### 10.6 compare_at (tachado honesto)

```txt
PVP (lista 'PVP') = $22.000 (2.200.000) ; salePrice DEFAULT = $18.000
compare_at = $22.000  (> salePrice → se muestra tachado, ahorro $4.000)
Si PVP fuese $17.000 (< salePrice) → compare_at = null (no se inventa oferta).
```

### 10.7 Base del KPI "cuánto invirtió" (cliente)

```txt
Cliente compró 2 unidades a salePrice $18.000 c/u; supplier_cost_snapshot = $12.000 c/u.
gastó (revenue del cliente) = 2 * 1.800.000 = 3.600.000 = $36.000
"cuánto se invirtió"        = 2 * 1.200.000 = 2.400.000 = $24.000   ← Σ supplier_cost_snapshot_minor
margen generado por el cliente = 3.600.000 − 2.400.000 = 1.200.000 = $12.000
(11-modulo-clientes consume esto; 16-modulo-finanzas lo agrega por período.)
```

---

## 11. Casos borde

```txt
1. Sin costo cargado (variante nueva importada sin costo o feed incompleto):
   - ComputeSalePrice sin price manual → NO_SUPPLIER_COST (422). La variante NO es publicable
     (regla de publicación de catalog exige precio vigente).
   - Con price manual: se permite vender, pero margin = null y finanzas marca "costo desconocido"
     (no se puede afirmar el margen). Alertar al dueño.

2. Moneda distinta (costo USD, lista ARS): CURRENCY_MISMATCH. No hay conversión implícita en este dominio.
   Conversión FX, si se necesita, es política explícita futura (tabla fx_rate + regla), no un cast.

3. Costo mayor que un precio manual viejo: al recibir SupplierCostChanged, el precio COMPUTED se recalcula;
   el MANUAL que ahora viola min_margin se LISTA para revisión (no se pisa) y se alerta. Nunca vender a pérdida silenciosa.

4. Cambio de regla global con miles de variantes: recálculo async por lotes (job, ADR-006); el request
   responde con estimación. Precios MANUAL intactos salvo violación de nuevo piso.

5. Descuento + min_margin en conflicto: clamp (auto) o rechazo (cupón). Nunca romper el piso (§5.2).

6. Redondeo en el límite (HALF_UP): definido y único; testeado con vectores fijos para no divergir entre
   card (catalog) y checkout (orders).

7. Race en checkout: precio cambia entre "ver carrito" y "confirmar":
   - checkout recomputa con ComputeSalePrice; si difiere del snapshot → PRICE_CHANGED (409); el cliente
     reconfirma el nuevo total (no se cobra un precio viejo, ni se vende barato por lag de UI).

8. Descuento agotado en concurrencia: SELECT ... FOR UPDATE sobre discount + CHECK used_count<=max_uses
   → segundo canje simultáneo recibe DISCOUNT_EXHAUSTED (409).

9. Vigencias solapadas al setear precio/costo: la tx cierra el vigente (valid_to = nuevo valid_from)
   antes de insertar; el índice parcial `uq_*_active` impide dos abiertos.

10. Variante sin stock: pricing igual calcula precio (precio ≠ disponibilidad); catalog decide mostrarla
    como "sin stock" usando inventory. Pricing no consulta stock.
```

---

## 12. Definition of Done (módulo pricing)

```txt
[ ] supplier_cost, price, price_list, markup_rule, discount con CHECK/UNIQUE/índices del §2 y migración desde cero.
[ ] ComputeSalePrice es función determinística pura (fecha como parámetro) con vectores de test (§10).
[ ] min_margin_pct es invariante irrompible: tests para COMPUTED (eleva), MANUAL (rechaza), DISCOUNT (clampa).
[ ] Redondeo determinístico único (helper compartido); mismo resultado en card y checkout (test de paridad).
[ ] El backend recalcula en checkout; PRICE_CHANGED (409) probado (precio distinto al snapshot del cliente).
[ ] Precio manual respeta min_margin; NO_SUPPLIER_COST y CURRENCY_MISMATCH probados.
[ ] Descuentos: vigencias, max_uses (concurrencia → DISCOUNT_EXHAUSTED), cupón vs automático, clamp por margen.
[ ] compare_at solo si > salePrice (tachado honesto) — test.
[ ] Presenter NUNCA filtra supplierCost/margin a rol sin pricing.viewCost — test de fuga (06 §salida).
[ ] Permisos: markup global solo OWNER/ADMIN; CATALOG_MANAGER restringido; FINANCE lee costo — tests de autz negativa (07).
[ ] PriceChanged emitido por outbox en la misma tx; invalida read model de card y cache — test de integración.
[ ] SetMarkupRule masivo va por cola (no bloquea request); precios MANUAL intactos salvo violación de piso.
[ ] Schemas Zod en packages/validators/src/pricing.ts compartidos front/back; sin req.body directo al ORM.
[ ] Snapshot para orders (unit_price_minor + supplier_cost_snapshot_minor) provisto por PricingPort — contrato testeado.
[ ] Sin float en ninguna ruta de dinero (ADR-007); sin `any` no justificado; logs sin costo/PII.
[ ] Errores tipados mapeados a code+HTTP del §9; mensajes públicos claros (sin costo, sin SQL).
```
