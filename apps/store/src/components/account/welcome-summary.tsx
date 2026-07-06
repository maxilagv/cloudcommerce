"use client";

import Link from "next/link";
import { Package, ShoppingBag, FileDown } from "lucide-react";
import { useAuth } from "@/store/auth";

const quickActions = [
  { href: "/orders", label: "Ver mis pedidos", icon: Package },
  { href: "/", label: "Nueva compra", icon: ShoppingBag },
  { href: "/account/documents", label: "Descargar factura", icon: FileDown },
];

export function WelcomeSummary() {
  const user = useAuth((s) => s.user);

  return (
    <div>
      <h1 className="text-[22px] font-bold text-cc-text">
        Hola, {user?.name.split(" ")[0] ?? "cliente"} 👋
      </h1>
      <p className="text-[14px] text-cc-muted mt-1">
        {user?.email}
        {user?.tier ? ` · ${user.tier}` : ""}
      </p>
      <div className="flex flex-wrap gap-2 mt-4">
        {quickActions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.label}
              href={a.href}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-cc-border text-[13px] font-medium text-cc-secondary bg-cc-shell hover:border-cc-primary-border hover:text-cc-primary hover:bg-cc-primary-soft transition-colors duration-[140ms] ease-cc-out cc-focus-ring"
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
              {a.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
