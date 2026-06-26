"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCatalog } from "@/store/catalog";
import type { SortKey } from "@/lib/catalog-filter";

const linkClass =
  "cc-focus-ring rounded-cc-sm px-3 py-2 text-sm font-medium transition-[color,background] duration-[140ms] ease-cc-out text-cc-secondary hover:bg-cc-primary-softer hover:text-cc-primary";

export function MainNav() {
  const router = useRouter();

  function goCatalog(sort?: SortKey) {
    if (sort) useCatalog.getState().setSort(sort);
    router.push("/#catalogo");
  }

  return (
    <nav className="hidden items-center gap-1 lg:flex">
      <Link
        href="/"
        className="cc-focus-ring rounded-cc-sm px-3 py-2 text-sm font-medium text-cc-text transition-[color,background] duration-[140ms] ease-cc-out"
      >
        Inicio
      </Link>
      <button type="button" onClick={() => goCatalog()} className={linkClass}>
        Catálogo
      </button>
      <button type="button" onClick={() => goCatalog("price-asc")} className={linkClass}>
        Ofertas
      </button>
      <button type="button" onClick={() => goCatalog("newest")} className={linkClass}>
        Novedades
      </button>
      <button type="button" onClick={() => goCatalog()} className={linkClass}>
        Marcas
      </button>
    </nav>
  );
}
