# 05 · Navegación y permisos

## 1. Estructura del sidebar

Un solo nivel de agrupación, sin acordeones anidados de más de un nivel (la navegación tiene que
resolverse en un vistazo, no explorarse). Orden fijo, no reordenable por el usuario en esta fase.

```
┌─────────────────────────┐
│ ⌘ CloudCommerce   [tema] │  ← logo + toggle claro/oscuro
├─────────────────────────┤
│ 📊 Resumen               │  dashboard
├─────────────────────────┤
│ CATÁLOGO                 │  ← separador de grupo (label, no clickeable)
│ 📦 Productos              │
│ 🗂  Categorías             │
│ 🖼  Media                  │
│ 📈 Inventario              │
├─────────────────────────┤
│ VENTAS                   │
│ 🧾 Pedidos                │
│ 👤 Clientes               │
│ 💲 Pricing                 │
├─────────────────────────┤
│ OPERACIÓN                │
│ 🚚 Proveedores            │
│ 📑 Finanzas                │
│ ✨ Herramientas IA         │
├─────────────────────────┤
│ ⚙️  Configuración          │
└─────────────────────────┘
```

(Los emoji son solo referencia de este documento — en implementación son íconos `lucide-react`
lineales, ver [03](./03-sistema-de-diseno.md) §5.)

## 2. Qué ve cada rol

La navegación **se filtra por rol al construir el árbol**, no se muestra deshabilitada — un
`CATALOG_MANAGER` no ve un ítem "Finanzas" tachado, directamente no existe en su sidebar. Esto es
consistente con cómo el backend ya oculta campos por rol (nunca `null`, directamente ausentes — ver
`docs/backend/07-auth-identidad.md`).

| Sección | OWNER | ADMIN | CATALOG_MANAGER | FINANCE | SUPPORT |
|---|:--:|:--:|:--:|:--:|:--:|
| Resumen (dashboard) | ✔ completo | ✔ completo | parcial* | ✔ con margen | parcial* |
| Productos / Categorías / Media | ✔ | ✔ | ✔ | ✖ | ✖ |
| Inventario | ✔ | ✔ | ✔ | ✖ | lectura |
| Pedidos | ✔ | ✔ | ✖ | lectura | ✔ (con motivo para datos sensibles) |
| Clientes | ✔ | ✔ | ✖ | ✖ | ✔ (con motivo) |
| Pricing | ✔ | ✔ | ✖ | ✖ | ✖ |
| Proveedores | ✔ | ✔ | lectura | ✖ | ✖ |
| Finanzas | ✔ | ✔ | ✖ | ✔ | ✖ |
| Herramientas IA | ✔ | ✔ | ✔ | ✖ | ✖ |
| Configuración | ✔ completo | ✔ salvo usuarios/dueño | ✖ | ✖ | ✖ |

\* "parcial" en dashboard: mismo overview, pero sin las tarjetas/columnas de margen y costo (ver
`docs/backend/modulos/18-modulo-dashboard-analytics.md` §3.1 — el backend ya omite esos campos del
shape, el frontend simplemente no renderiza lo que no llegó).

Fuente de verdad: esta tabla es la proyección UI de la matriz de permisos ya definida en
[`docs/backend/07-auth-identidad.md`](../backend/07-auth-identidad.md) — no se duplica lógica de
autorización en el frontend más allá de esconder/mostrar navegación; **la autorización real siempre
la hace el backend en cada procedimiento**, el frontend nunca es la única barrera.

## 3. Implementación

```ts
// lib/navigation.ts (ilustrativo)
type NavItem = { label: string; href: string; icon: LucideIcon; minRole?: AdminRole[] };

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Catálogo", items: [
    { label: "Productos", href: "/productos", icon: Package, minRole: ["OWNER","ADMIN","CATALOG_MANAGER"] },
    // ...
  ]},
];

// se filtra en el layout server component con el actor ya resuelto por el middleware de auth,
// nunca client-side puro (evita el flash de un ítem que después se oculta)
```

El layout `(dashboard)/layout.tsx` resuelve el `Actor` (vía `identity.me` o el contexto de sesión ya
armado por `apps/api/src/interfaces/trpc/context.ts`) **server-side**, arma el árbol de navegación ya
filtrado, y lo pasa al `Sidebar` — así no hay parpadeo de ítems que aparecen y desaparecen tras la
hidratación.

## 4. Topbar

Elementos, de izquierda a derecha: breadcrumb de la sección actual (ya scaffoldeado en
`components/layout/breadcrumb.tsx`), buscador global (command palette, `⌘K`, busca productos/pedidos/
clientes por nombre o ID — atajo de teclado visible como hint), notificaciones (alertas de stock bajo,
generaciones IA fallidas, feeds de proveedor con error), y el menú de usuario (avatar, nombre, rol,
"Cerrar sesión", "Ver mis sesiones activas").

## 5. Command palette (`⌘K` / `Ctrl+K`)

No es solo búsqueda: incluye acciones rápidas ("Crear producto", "Nuevo pedido manual", "Cambiar
tema") junto con resultados de búsqueda, en dos secciones separadas dentro del mismo modal. Se
construye sobre `packages/ui`'s `combobox.tsx`. Es el mecanismo principal para saltar entre módulos
sin tocar el mouse — relevante para un panel que se usa muchas horas seguidas.

## 6. Breadcrumb + acciones de página

Cada página tiene un header estándar (`packages/ui`'s `page-header.tsx`): breadcrumb, título, y hasta
2 acciones primarias a la derecha (ej. "Nuevo producto" + "Importar CSV" en la lista de productos).
Nunca más de 2 — si una pantalla necesita más acciones, van a un menú `⋮` secundario.
