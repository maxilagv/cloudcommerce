# 01 · Visión y alcance

## Principio rector

El backend de CloudCommerce es el **sistema nervioso** del producto. No es una capa que devuelve JSON:
es la **autoridad** de negocio, seguridad, datos, trazabilidad, permisos, consistencia y operación.

No buscamos un backend "que funcione". Buscamos uno que **crezca sin volverse frágil**, soporte tráfico
real y preserve la integridad de cada producto, cliente, pedido, remito, envío e interacción de IA.

La implementación del core es **puramente TypeScript/Node.js**. La inteligencia analítica vive aparte
en el servicio Python (`apps/ai`); el backend core mantiene su frontera TS/Node y habla con IA por un puerto.

## Definición de "backend perfecto" para este proyecto

Se considera excelente cuando cumple, al mismo tiempo:

1. **Correcto** — cada regla de negocio está en un lugar claro, testeada y protegida contra estados inválidos.
2. **Seguro** — asume que todo request, webhook, archivo, token, filtro y parámetro puede ser malicioso.
3. **Trazable** — todo request se investiga por `requestId`, actor, endpoint, entidad y evento de dominio.
4. **Validado** — nada entra al dominio sin validación de forma, tipo, rango, permisos e invariantes.
5. **Consistente** — transacciones, locks, idempotencia y eventos evitan duplicados y carreras.
6. **Observable** — métricas, logs, traces, health checks y alertas detectan problemas antes que el cliente.
7. **Documentado** — OpenAPI, ADRs y runbooks están vivos.
8. **Testeado** — unit, integration, contract, security y load tests bloquean regresiones.
9. **Performante** — pagina, evita N+1, cachea donde corresponde y mide queries.
10. **Evolutivo** — se cambia una parte sin romper el sistema.

## Alcance del sistema

Un único backend sirve a dos superficies:

- **Panel admin** (dueño) — consumidor **prioritario** de esta fase.
- **Store** (clientes) — consumidor del dominio ya expuesto; se conecta cuando su módulo esté listo.

### Lo que el panel admin debe resolver (pedido explícito del dueño)

El panel tiene dos partes: **login** y **panel**. Dentro del panel:

| Sección | Alcance | Doc de módulo |
|---------|---------|---------------|
| **Dashboard** | KPIs del negocio, gráficos, actividad reciente | [18](./modulos/18-modulo-dashboard-analytics.md) |
| **ABM Clientes** | Alta (nombre, apellido; WSP opcional), domicilios AR (provincia, ciudad, entre calles, número), listado con búsqueda (lupa), detalle con analytics: compras (gráfico circular), veces que llamó, cuánto gastó, cuánto se invirtió | [11](./modulos/11-modulo-clientes.md) |
| **ABM Productos** | Nombre, descripción, especificaciones, categoría(s), 1–6 imágenes; descripción/specs e imágenes generables por **IA** | [10](./modulos/10-modulo-catalogo.md) |
| **ABM Categorías** | Categorías y subcategorías con imágenes (subibles desde disco) | [10](./modulos/10-modulo-catalogo.md) |
| **ABM Finanzas** | Ingresos, costos, márgenes, documentos comerciales (remito/factura/nota de crédito) | [16](./modulos/16-modulo-finanzas.md) |
| **ABM IA** | Gestión de herramientas de IA: generación de contenido, alertas, uso/costos | [17](./modulos/17-modulo-ia-gateway.md) |
| **Configuración** | Datos de la tienda, envíos, pagos, usuarios admin, feature flags | [19](./modulos/19-modulo-configuracion.md) |

> El **seguimiento con IA de clientes** queda marcado como *próximamente* (el dueño lo indicó). Se deja
> el gancho en el módulo de clientes ([11](./modulos/11-modulo-clientes.md) §Seguimiento IA) pero no se
> implementa en la primera fase.

### Dirección de los módulos restantes (decisión del backend)

El dueño pidió que definamos la dirección de los módulos no detallados. Decisión:

- **Órdenes/Checkout/Envíos** ([15](./modulos/15-modulo-ordenes.md)): necesarios para que "cuánto gastó
  el cliente" y las finanzas sean reales. Se construyen aunque el store aún no tenga checkout, porque el
  **admin también puede crear pedidos manuales** (venta asistida por WhatsApp/teléfono, típico en
  dropshipping local).
- **Inventario** ([13](./modulos/13-modulo-inventario.md)) y **Pricing** ([14](./modulos/14-modulo-pricing.md)):
  soportan el catálogo (stock visible, precio con markup dropshipping auditable).
- **Suppliers/Feeds** ([20](./modulos/20-modulo-suppliers.md)): motor del dropshipping (importar productos
  con markup, reenviar pedidos). Se documenta ahora; se implementa después del catálogo.
- **Media/Storage** ([12](./modulos/12-modulo-media-storage.md)): transversal, requerido ya por productos y
  categorías (subida desde disco + generación IA).

## No-objetivos (esta fase)

- Portal de autoservicio del cliente (tracking/devoluciones self-service) — fase futura.
- Microservicios: se empieza como **modular monolith**; no se fragmenta sin necesidad operacional real.
- Multi-tenant: single-tenant (una tienda, un dueño). El diseño no bloquea multi-tenant futuro.
- Motor de búsqueda externo (Elastic/Meili): se arranca con PostgreSQL (FTS + trigram); se migra si hace falta.
- IA generativa dentro del core TS: prohibido; toda IA vive en `apps/ai`.

## Resultado esperado

El backend debe sentirse **invisible para el usuario** y **evidente para el equipo**: no estorba, no
sorprende con errores absurdos, no pierde datos, no duplica compras, no muestra información ajena, no se
cae por payloads tontos y no obliga a reescribir todo cuando el negocio crece.

> La estética del frontend vende la experiencia. Este backend debe **sostener la promesa**.
