"use client";

import Image from "next/image";
import Link from "next/link";
import { Scale, Star, Trash2, X } from "lucide-react";
import { cn, formatCOP } from "@/lib/utils";
import { useHydrated } from "@/hooks/use-hydrated";
import { useCompare } from "@/store/compare";
import { getProductDetail } from "@/lib/mock-product-detail";
import { AddToCartButton } from "@/components/product/add-to-cart-button";

export default function ComparePage() {
  const hydrated = useHydrated();
  const items = useCompare((s) => s.items);
  const remove = useCompare((s) => s.remove);
  const clear = useCompare((s) => s.clear);

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
          href="/"
          className="mt-2 rounded-[11px] bg-cc-primary px-6 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-cc-primary-hover"
        >
          Explorar catálogo
        </Link>
      </div>
    );
  }

  // Resolve full detail (for specs) per compared product.
  const details = items.map((item) => getProductDetail(item.id)).filter(Boolean);

  // Build the ordered union of spec labels across all products.
  const labelOrder: string[] = [];
  const valueByProduct = new Map<string, Map<string, string>>();
  for (const d of details) {
    if (!d) continue;
    const map = new Map<string, string>();
    for (const section of d.specs) {
      for (const row of section.rows) {
        if (!labelOrder.includes(row.label)) labelOrder.push(row.label);
        map.set(row.label, row.value);
      }
    }
    valueByProduct.set(d.id, map);
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
                      href={`/products/${p.id}`}
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
                      href={`/products/${p.id}`}
                      className="text-[13px] font-semibold leading-snug text-cc-text hover:text-cc-primary"
                    >
                      {p.name}
                    </Link>
                    <div className="flex items-center gap-1 text-[12px] text-cc-secondary">
                      <Star className="h-3.5 w-3.5 fill-cc-star text-cc-star" />
                      {p.rating.toFixed(1)}
                      <span className="text-cc-faint">({p.reviewCount})</span>
                    </div>
                    <p className="text-[16px] font-extrabold tracking-tight text-cc-text">
                      {formatCOP(p.price)}
                    </p>
                    <AddToCartButton product={p} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
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
