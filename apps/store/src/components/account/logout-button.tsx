"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";

export function LogoutButton() {
  const router = useRouter();
  const logout = useAuth((s) => s.logout);

  async function handleLogout() {
    await logout();
    toast.info("Sesión cerrada");
    router.push("/");
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-cc-sm text-[13px] font-medium text-cc-muted hover:bg-red-50 hover:text-red-600 transition-colors duration-[140ms] ease-cc-out cc-focus-ring"
    >
      <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.8} />
      Cerrar sesión
    </button>
  );
}
