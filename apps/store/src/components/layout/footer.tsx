import Link from "next/link";
import { Headphones, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { getStoreCategories } from "@/lib/api/catalog";
import { categoryHref } from "@/lib/catalog-types";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo/site";
import { BrandLogo } from "./brand-logo";

const SHOP_LINKS = [
  { label: "Catálogo completo", href: "/products" },
  { label: "Ofertas", href: "/products?deals=1" },
  { label: "Novedades", href: "/products?sort=newest" },
  { label: "Comparar productos", href: "/compare" },
];

const ACCOUNT_LINKS = [
  { label: "Mi cuenta", href: "/account" },
  { label: "Mis pedidos", href: "/orders" },
  { label: "Carrito", href: "/cart" },
  { label: "Crear cuenta", href: "/register" },
];

const SERVICE_ITEMS = [
  { icon: Truck, label: "Envíos a todo el país" },
  { icon: ShieldCheck, label: "Compra 100% protegida" },
  { icon: RotateCcw, label: "Devoluciones hasta 30 días" },
  { icon: Headphones, label: "Soporte experto" },
];

/** Site footer — brand, real category links, shop/account navigation. */
export async function SiteFooter() {
  const categories = (await getStoreCategories()).filter((c) => c.isActive).slice(0, 6);

  return (
    <footer className="border-t border-cc-border bg-cc-surface">
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div className="max-w-[320px]">
            <BrandLogo />
            <p className="mt-3 text-[13px] leading-6 text-cc-secondary">
              {SITE_TAGLINE}. Electrónica y electrodomésticos originales con
              garantía oficial y envío rápido a todo el país.
            </p>
            <ul className="mt-4 grid gap-2">
              {SERVICE_ITEMS.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-2 text-[12px] font-semibold text-cc-muted"
                >
                  <Icon className="h-4 w-4 text-cc-primary" strokeWidth={1.9} />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* Categories (real) */}
          {categories.length > 0 && (
            <nav aria-label="Categorías">
              <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-cc-text">
                Categorías
              </p>
              <ul className="mt-3 grid gap-2">
                {categories.map((category) => (
                  <li key={category.id}>
                    <Link
                      href={categoryHref(category.slug)}
                      className="cc-focus-ring text-[13px] text-cc-secondary transition-colors duration-[140ms] hover:text-cc-primary"
                    >
                      {category.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {/* Shop */}
          <nav aria-label="Comprar">
            <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-cc-text">
              Comprar
            </p>
            <ul className="mt-3 grid gap-2">
              {SHOP_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="cc-focus-ring text-[13px] text-cc-secondary transition-colors duration-[140ms] hover:text-cc-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Account */}
          <nav aria-label="Tu cuenta">
            <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-cc-text">
              Tu cuenta
            </p>
            <ul className="mt-3 grid gap-2">
              {ACCOUNT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="cc-focus-ring text-[13px] text-cc-secondary transition-colors duration-[140ms] hover:text-cc-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-cc-border-subtle pt-6 sm:flex-row">
          <p className="text-[12px] text-cc-muted">
            © {new Date().getFullYear()} {SITE_NAME}. Todos los derechos reservados.
          </p>
          <p className="text-[12px] text-cc-faint">
            Precios expresados en pesos argentinos (ARS).
          </p>
        </div>
      </div>
    </footer>
  );
}
