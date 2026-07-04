import { AdminRole } from "@cloudcommerce/types";
import {
  LayoutDashboard,
  Package,
  LayoutGrid,
  Image as ImageIcon,
  Boxes,
  ClipboardList,
  Users,
  BadgeDollarSign,
  Truck,
  FileText,
  Sparkles,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: AdminRole[];
  badge?: string;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

const A = AdminRole;
const ALL: AdminRole[] = [A.OWNER, A.ADMIN, A.CATALOG_MANAGER, A.FINANCE, A.SUPPORT];
const CATALOG: AdminRole[] = [A.OWNER, A.ADMIN, A.CATALOG_MANAGER];

/** Source of truth for the sidebar. Roles mirror docs/admin/05-navegacion-y-permisos.md. */
export const NAV_GROUPS: NavGroup[] = [
  { items: [{ label: "Resumen", href: "/", icon: LayoutDashboard, roles: ALL }] },
  {
    label: "Catálogo",
    items: [
      { label: "Productos", href: "/productos", icon: Package, roles: CATALOG },
      { label: "Categorías", href: "/categorias", icon: LayoutGrid, roles: CATALOG },
      { label: "Media", href: "/media", icon: ImageIcon, roles: CATALOG },
      { label: "Inventario", href: "/inventario", icon: Boxes, roles: [A.OWNER, A.ADMIN, A.CATALOG_MANAGER, A.SUPPORT] },
    ],
  },
  {
    label: "Ventas",
    items: [
      { label: "Pedidos", href: "/pedidos", icon: ClipboardList, roles: [A.OWNER, A.ADMIN, A.FINANCE, A.SUPPORT] },
      { label: "Clientes", href: "/clientes", icon: Users, roles: [A.OWNER, A.ADMIN, A.SUPPORT] },
      { label: "Pricing", href: "/pricing", icon: BadgeDollarSign, roles: [A.OWNER, A.ADMIN] },
    ],
  },
  {
    label: "Operación",
    items: [
      { label: "Proveedores", href: "/proveedores", icon: Truck, roles: [A.OWNER, A.ADMIN, A.CATALOG_MANAGER] },
      { label: "Finanzas", href: "/finanzas", icon: FileText, roles: [A.OWNER, A.ADMIN, A.FINANCE] },
      { label: "Herramientas IA", href: "/ia", icon: Sparkles, roles: CATALOG },
    ],
  },
  { items: [{ label: "Configuración", href: "/configuracion", icon: Settings, roles: [A.OWNER, A.ADMIN] }] },
];

/** Build the nav tree already filtered for a role — items a role can't see don't exist. */
export function navForRole(role: AdminRole): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter(
    (g) => g.items.length > 0,
  );
}
