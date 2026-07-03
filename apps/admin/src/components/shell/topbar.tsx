"use client";

import { useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useToast,
} from "@cloudcommerce/ui";
import { trpc, type MeResponse } from "@/lib/trpc";
import { initials } from "@/lib/format";
import { useUiStore } from "@/stores/ui-store";
import { ThemeToggle } from "./theme-toggle";

export function Topbar({ me }: { me: MeResponse }) {
  const router = useRouter();
  const { toast } = useToast();
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const name = me.profile.fullName;
  const role = me.profile.role;

  async function logout() {
    try {
      await trpc.identity.logout.mutate();
    } catch {
      // even if the call fails, drop the user to login — the cookie is gone-ish
    }
    router.replace("/login");
  }

  return (
    <header className="admin-topbar">
      <button className="admin-hamb" onClick={toggleSidebar} aria-label="Contraer menú">
        <Menu size={20} />
      </button>
      <div className="admin-crumb">
        <span>CloudCommerce</span>
      </div>
      <div className="admin-topbar__sp" />
      <button className="admin-search" onClick={() => toast({ tone: "info", title: "Búsqueda", message: "⌘K llega en una próxima fase" })}>
        <Search size={15} />
        Buscar…
        <kbd>⌘K</kbd>
      </button>
      <button
        className="admin-tb-btn"
        aria-label="Notificaciones"
        onClick={() => toast({ tone: "info", title: "Notificaciones", message: "Sin alertas nuevas" })}
      >
        <span className="admin-tb-btn__dot" />
        <Bell size={18} />
      </button>
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="admin-avatar" aria-label="Menú de usuario">
            {initials(name)}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>
            {name} · {role}
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => router.push("/configuracion/sesiones")}>
            Mis sesiones activas
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem tone="danger" onSelect={logout}>
            <LogOut size={15} />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
