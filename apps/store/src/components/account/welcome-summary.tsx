"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { FileDown, Package, ShoppingBag, Star } from "lucide-react";
import { useAuth } from "@/store/auth";
import { fadeSlideUp } from "@/lib/motion";

const quickActions = [
  { href: "/orders", label: "Ver mis pedidos", icon: Package },
  { href: "/", label: "Nueva compra", icon: ShoppingBag },
  { href: "/account/documents", label: "Descargar factura", icon: FileDown },
];

export function WelcomeSummary() {
  const user = useAuth((state) => state.user);

  return (
    <motion.div variants={fadeSlideUp} initial="hidden" animate="visible">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-[24px] font-extrabold tracking-tight text-cc-text">
          Hola, {user?.name.split(" ")[0] ?? "cliente"}
        </h1>
        {user?.tier && (
          <span className="inline-flex min-h-8 items-center gap-1 rounded-full bg-cc-primary-soft px-2.5 text-[12px] font-bold text-cc-primary">
            <Star className="h-3.5 w-3.5" fill="currentColor" strokeWidth={1.75} />
            {user.tier}
          </span>
        )}
      </div>
      <p className="mt-1 text-[14px] text-cc-muted">{user?.email}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className="cc-focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-full border border-cc-border bg-cc-shell px-3.5 text-[13px] font-medium text-cc-secondary transition-[color,background-color,border-color] duration-[var(--cc-duration-fast)] ease-cc-out hover:border-cc-primary-border hover:bg-cc-primary-soft hover:text-cc-primary"
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              {action.label}
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}
