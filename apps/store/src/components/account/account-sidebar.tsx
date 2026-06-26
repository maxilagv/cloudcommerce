import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  Heart,
  MapPin,
  CreditCard,
  FileText,
  Settings,
  Star,
} from "lucide-react";
import { mockProfile } from "@/lib/mock-account";
import { LogoutButton } from "./logout-button";

const navLinks = [
  { href: "/account", label: "Inicio", icon: LayoutDashboard },
  { href: "/orders", label: "Mis pedidos", icon: Package },
  { href: "/account/favorites", label: "Favoritos", icon: Heart },
  { href: "/account/addresses", label: "Direcciones", icon: MapPin },
  { href: "/account/addresses", label: "Métodos de pago", icon: CreditCard },
  { href: "/account/documents", label: "Documentos", icon: FileText },
  { href: "/account/settings", label: "Configuración", icon: Settings },
];

export function AccountSidebar({ activePath }: { activePath?: string }) {
  return (
    <aside className="hidden lg:flex flex-col w-[240px] shrink-0">
      {/* Profile card */}
      <div className="bg-cc-shell border border-cc-border-subtle rounded-cc-xl shadow-cc-sm p-4 flex flex-col items-center gap-3 mb-4">
        <div className="h-14 w-14 rounded-full bg-cc-primary flex items-center justify-center text-white text-[20px] font-bold">
          {mockProfile.initials}
        </div>
        <div className="text-center">
          <p className="text-[14px] font-semibold text-cc-text leading-snug">
            {mockProfile.name}
          </p>
          <p className="text-[12px] text-cc-muted mt-0.5">{mockProfile.email}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-cc-primary-soft px-2.5 py-0.5 text-[11px] font-bold text-cc-primary">
          <Star className="h-2.5 w-2.5" fill="currentColor" />
          {mockProfile.tier}
        </span>
      </div>

      {/* Nav */}
      <nav className="bg-cc-shell border border-cc-border-subtle rounded-cc-xl shadow-cc-sm overflow-hidden flex-1 flex flex-col">
        <ul className="flex-1 p-2 flex flex-col gap-0.5">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = activePath === link.href;
            return (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className={[
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-cc-sm text-[13px] font-medium transition-colors duration-[140ms] ease-cc-out cc-focus-ring",
                    isActive
                      ? "bg-cc-primary-soft text-cc-primary"
                      : "text-cc-secondary hover:bg-cc-bg-hover hover:text-cc-text",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-cc-border-subtle p-2">
          <LogoutButton />
        </div>
      </nav>
    </aside>
  );
}
