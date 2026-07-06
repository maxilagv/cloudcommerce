"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import {
  Boxes,
  Brain,
  CircleDollarSign,
  CornerDownLeft,
  FolderTree,
  LayoutDashboard,
  Package,
  Receipt,
  Search,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatMinor } from "@/lib/format";

type PaletteState = { open: boolean; setOpen: (open: boolean) => void };

const usePalette = create<PaletteState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

/** Open the palette from anywhere (e.g. the topbar search button). */
export function openCommandPalette() {
  usePalette.setState({ open: true });
}

type NavItem = { label: string; href: string; icon: LucideIcon; keywords: string };

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, keywords: "inicio kpis resumen" },
  { label: "Productos", href: "/productos", icon: Package, keywords: "catalogo articulos" },
  { label: "Categorías", href: "/categorias", icon: FolderTree, keywords: "arbol taxonomia" },
  { label: "Inventario", href: "/inventario", icon: Boxes, keywords: "stock existencias" },
  { label: "Pedidos", href: "/pedidos", icon: ShoppingCart, keywords: "ordenes ventas" },
  { label: "Clientes", href: "/clientes", icon: Users, keywords: "crm compradores" },
  { label: "Proveedores", href: "/proveedores", icon: Truck, keywords: "dropshipping feeds" },
  { label: "Finanzas", href: "/finanzas", icon: Receipt, keywords: "facturas documentos" },
  { label: "Pricing", href: "/pricing", icon: CircleDollarSign, keywords: "precios margenes descuentos" },
  { label: "IA", href: "/ia", icon: Brain, keywords: "inteligencia artificial generaciones" },
  { label: "Configuración", href: "/configuracion", icon: Settings, keywords: "ajustes usuarios sesiones tienda" },
];

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Global command palette (Ctrl/Cmd+K): navigate to any section or jump
 * straight to a product via live catalog search.
 */
export function CommandPalette() {
  const open = usePalette((s) => s.open);
  const setOpen = usePalette((s) => s.setOpen);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  // Global shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        usePalette.setState((s) => ({ open: !s.open }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Reset + focus on open.
  useEffect(() => {
    if (open) {
      setQuery("");
      setDebounced("");
      setActiveIndex(0);
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  // Debounce product search.
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 220);
    return () => window.clearTimeout(t);
  }, [query]);

  const productsQuery = useQuery({
    queryKey: ["palette", "products", debounced],
    queryFn: () => trpc.catalog.products.autocomplete.query({ query: debounced }),
    enabled: open && debounced.length >= 2,
    staleTime: 15_000,
  });

  const navMatches = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return NAV_ITEMS;
    return NAV_ITEMS.filter((item) => normalize(`${item.label} ${item.keywords}`).includes(q));
  }, [query]);

  const products = debounced.length >= 2 ? (productsQuery.data ?? []) : [];
  const totalCount = navMatches.length + products.length;

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router, setOpen],
  );

  function selectIndex(index: number) {
    if (index < navMatches.length) {
      go(navMatches[index].href);
    } else {
      const product = products[index - navMatches.length];
      if (product) go(`/productos/${product.id}`);
    }
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (totalCount === 0 ? 0 : (i + 1) % totalCount));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (totalCount === 0 ? 0 : (i - 1 + totalCount) % totalCount));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectIndex(activeIndex);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Clamp the highlight when results shrink.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(totalCount - 1, 0)));
  }, [totalCount]);

  if (!open) return null;

  return (
    <div className="admin-cmdk__overlay" onClick={() => setOpen(false)} role="presentation">
      <div
        className="admin-cmdk"
        role="dialog"
        aria-modal="true"
        aria-label="Búsqueda rápida"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-cmdk__input">
          <Search size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Buscar secciones o productos…"
            aria-label="Buscar secciones o productos"
          />
          <kbd>Esc</kbd>
        </div>

        <div className="admin-cmdk__list" role="listbox">
          {navMatches.length > 0 && <div className="admin-cmdk__group">Secciones</div>}
          {navMatches.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                type="button"
                role="option"
                aria-selected={activeIndex === i}
                data-active={activeIndex === i || undefined}
                className="admin-cmdk__item"
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => selectIndex(i)}
              >
                <span className="admin-cmdk__icon">
                  <Icon size={15} />
                </span>
                <span className="admin-cmdk__label">{item.label}</span>
                <CornerDownLeft size={13} className="admin-cmdk__enter" />
              </button>
            );
          })}

          {debounced.length >= 2 && (
            <>
              <div className="admin-cmdk__group">Productos</div>
              {productsQuery.isLoading ? (
                <div className="admin-cmdk__empty">Buscando…</div>
              ) : products.length === 0 ? (
                <div className="admin-cmdk__empty">Sin productos para “{debounced}”</div>
              ) : (
                products.map((product, offset) => {
                  const i = navMatches.length + offset;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      role="option"
                      aria-selected={activeIndex === i}
                      data-active={activeIndex === i || undefined}
                      className="admin-cmdk__item"
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => selectIndex(i)}
                    >
                      <span className="admin-cmdk__icon">
                        <Package size={15} />
                      </span>
                      <span className="admin-cmdk__label">
                        {product.title}
                        <span className="admin-cmdk__sub admin-mono">
                          {product.sku ?? "sin SKU"}
                          {product.price ? ` · ${formatMinor(product.price.amountMinor)}` : ""}
                        </span>
                      </span>
                      <CornerDownLeft size={13} className="admin-cmdk__enter" />
                    </button>
                  );
                })
              )}
            </>
          )}

          {totalCount === 0 && debounced.length < 2 && (
            <div className="admin-cmdk__empty">Escribí para buscar…</div>
          )}
        </div>

        <div className="admin-cmdk__foot">
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span>esc cerrar</span>
        </div>
      </div>
    </div>
  );
}
