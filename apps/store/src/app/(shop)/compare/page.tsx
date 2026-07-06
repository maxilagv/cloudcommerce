"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Scale, Trash2, X } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { useHydrated } from "@/hooks/use-hydrated";
import { useCompare } from "@/store/compare";
import { productHref, type ProductCardData } from "@/lib/catalog-types";
import { mapDetailToUi } from "@/lib/api/catalog";
import { trpc } from "@/lib/trpc";
import type { SpecRow } from "@/lib/product-detail-types";
import { AddToCartButton } from "@/components/product/add-to-cart-button";

const STOCK_LABEL: Record<ProductCardData["stockStatus"], string> = {
  "in-stock": "En stock",
  soon: "Próximamente",
  "out-of-stock": "Sin stock",
};

/** Rows every product can answer from its card data alone. */
function baseRows(p: ProductCardData): SpecRow[] {
  return [
    { label: "Marca", value: p.brand || "—" },
    { label: "Categoría", value: p.category || "—" },
    { label: "SKU", value: p.sku ?? "—" },
    { label: "Disponibilidad", value: STOCK_LABEL[p.stockStatus] },
    ...(p.oldPrice ? [{ label: "Precio anterior", value: formatPrice(p.oldPrice) }] : []),
  ];
}

export default function ComparePage() {
  const hydrated = useHydrated();
  const items = useCompare((s) => s.items);
  const remove = useCompare((s) => s.remove);
  const clear = useCompare((s) => s.clear);

  // Real specs per product, fetched from the live catalog by slug.
  const [specsById, setSpecsById] = useState<Record<string, SpecRow[]>>({});
  const [loadingSpecs, setLoadingSpecs] = useState(false);
  const itemsKey = items.map((i) => i.id).join(",");

  useEffect(() => {
    const withSlug = items.filter((i) => i.slug);
    if (withSlug.length === 0) return;
    let cancelled = false;
    setLoadingSpecs(true);
    void Promise.all(
      withSlug.map(async (item) => {
        try {
          const detail = await trpc.store.products.bySlug.query({ slug: item.slug! });
          const rows = mapDetailToUi(detail).specs.flatMap((section) => section.rows);
          return [item.id, rows] as const;
        } catch {
          return [item.id, []] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setSpecsById(Object.fromEntries(entries));
      setLoadingSpecs(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  // Ordered union of row labels: base card rows first, then real specs.
  const { labelOrder, valueByProduct } = useMemo(() => {
    const order: string[] = [];
    const values = new Map<string, Map<string, string>>();
    for (const item of items) {
      const map = new Map<string, string>();
      for (const row of [...baseRows(item), ...(specsById[item.id] ?? [])]) {
        if (!order.includes(row.label)) order.push(row.label);
        if (!map.has(row.label)) map.set(row.label, row.value);
      }
      values.set(item.id, map);
    }
    return { labelOrder: order, valueByProduct: values };
  }, [items, specsById]);

  if (!hydrated) {
    return <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6" />;
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-center gap-4 px-4 py-24 text-center sm:px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cc-soft">
          <Scale className="h-8 w-8 text-cc-muted" strokeWidth={1.5} />
        </div>
        <p className="text-[16px] font-semibold text-cc-text">
          No hay productos para comparar
        </p>
        <p className="max-w-[260px] text-[13px] text-cc-muted">
          Agregá productos al comparador desde el catálogo con el botón de la balanza.
        </p>
        <Link
          href="/products"
          className="mt-2 rounded-[11px] bg-cc-primary px-6 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-cc-primary-hover"
        >
          Explorar catálogo
        </Link>
      </div>
    );
  }

  const colWidth = "min-w-[220px] max-w-[260px]";

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Scale className="h-6 w-6 text-cc-primary" strokeWidth={1.9} />
          <h1 className="text-[20px] font-bold text-cc-text">
            Comparar productos
            <span className="ml-2 text-[14px] font-medium text-cc-muted">
              ({items.length})
            </span>
          </h1>
        </div>
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1.5 text-[13px] font-medium text-cc-muted hover:text-cc-danger"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.9} />
          Vaciar
        </button>
      </div>

      <div className="mt-6 overflow-x-auto pb-4">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-[140px] bg-cc-page text-left align-top" />
              {items.map((p) => (
                <th key={p.id} className={cn("p-2 align-top", colWidth)}>
                  <div className="relative flex flex-col gap-2 rounded-cc-lg border border-cc-border bg-white p-3">
                    <button
                      type="button"
                      onClick={() => remove(p.id)}
                      aria-label={`Quitar ${p.name}`}
                      className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-cc-muted transition-colors hover:bg-cc-soft hover:text-cc-danger"
                    >
                      <X className="h-4 w-4" strokeWidth={2} />
                    </button>
                    <Link
                      href={productHref(p)}
                      className="flex h-28 items-center justify-center rounded-cc-sm bg-cc-soft"
                    >
                      <Image
                        src={p.image}
                        alt={p.imageAlt}
                        width={96}
                        height={96}
                        className="h-24 w-24 object-contain"
                      />
                    </Link>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-cc-muted">
                      {p.brand}
                    </p>
                    <Link
                      href={productHref(p)}
                      className="text-[13px] font-semibold leading-snug text-cc-text hover:text-cc-primary"
                    >
                      {p.name}
                    </Link>
                    <span
                      className={cn(
                        "inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        p.stockStatus === "in-stock"
                          ? "bg-cc-success-soft text-cc-success"
                          : p.stockStatus === "soon"
                            ? "bg-cc-warning-soft text-cc-warning"
                            : "bg-cc-soft text-cc-muted",
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {STOCK_LABEL[p.stockStatus]}
                    </span>
                    <p className="text-[16px] font-extrabold tracking-tight text-cc-text">
                      {formatPrice(p.price)}
                    </p>
                    <AddToCartButton product={p} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loadingSpecs && (
              <tr>
                <td className="sticky left-0 z-10 bg-inherit p-3" />
                {items.map((p) => (
                  <td key={p.id} className={cn("p-3", colWidth)}>
                    <div className="cc-skeleton h-4 w-3/4 rounded" />
                  </td>
                ))}
              </tr>
            )}
            {labelOrder.map((label, idx) => (
              <tr key={label} className={idx % 2 === 0 ? "bg-white" : "bg-cc-soft/40"}>
                <td className="sticky left-0 z-10 bg-inherit p-3 align-top text-[12px] font-semibold text-cc-secondary">
                  {label}
                </td>
                {items.map((p) => (
                  <td
                    key={p.id}
                    className={cn("p-3 align-top text-[13px] text-cc-text", colWidth)}
                  >
                    {valueByProduct.get(p.id)?.get(label) ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
