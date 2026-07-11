"use client";

import Link from "next/link";
import Image from "next/image";
import { Check, Scale, Star, Truck, Sparkles } from "lucide-react";
import { productHref, type ProductCardData } from "@/lib/catalog-types";
import { cn, formatPrice } from "@/lib/utils";
import { useViewTransitionNavigate } from "@/hooks/use-view-transition-navigate";
import { useCompare } from "@/store/compare";
import { FavoriteButton } from "./favorite-button";
import { AddToCartButton } from "./add-to-cart-button";

/** Top-left badge (stock / discount / new / soon) — tarjetas.md §5. */
function TopBadge({ badge }: { badge: NonNullable<ProductCardData["badge"]> }) {
  const base =
    "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold";
  switch (badge.type) {
    case "stock":
      return (
        <span className={cn(base, "bg-cc-success-soft text-cc-success")}>
          <span className="h-1.5 w-1.5 rounded-full bg-cc-success" />
          {badge.label}
        </span>
      );
    case "discount":
      return (
        <span
          className={cn(
            base,
            "bg-cc-primary text-white shadow-[0_8px_18px_rgba(11,107,255,0.22)]",
          )}
        >
          {badge.label}
        </span>
      );
    case "new":
      return (
        <span className={cn(base, "bg-cc-primary-soft text-cc-primary")}>
          {badge.label}
        </span>
      );
    case "soon":
      return (
        <span className={cn(base, "bg-cc-warning-soft text-cc-warning")}>
          {badge.label}
        </span>
      );
  }
}

export function ProductCard({
  product,
  aiRecommended,
}: {
  product: ProductCardData;
  aiRecommended?: boolean;
}) {
  const toggleCompare = useCompare((s) => s.toggle);
  const inCompare = useCompare((s) => s.has(product.id));
  const navigate = useViewTransitionNavigate();
  const href = productHref(product);

  return (
    <article
      className={cn(
        "group relative flex min-h-[420px] flex-col overflow-hidden rounded-cc-lg border border-cc-border bg-cc-surface p-3.5 shadow-cc-xs",
        "transition-[transform,box-shadow,border-color] duration-[220ms] ease-cc-out",
        "hover:-translate-y-[3px] hover:border-cc-primary-border hover:shadow-cc-md",
      )}
    >
      {/* Full-card link overlay. Content wrappers are pointer-events-none so
          clicks fall through to this link; interactive controls re-enable
          pointer events (pointer-events-auto) to keep working. */}
      <Link
        href={href}
        className="absolute inset-0 z-0 rounded-cc-lg"
        aria-label={`Ver ${product.name}`}
        onClick={(e) => {
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          navigate(href);
        }}
      />

      {/* Top row: badge + favorite */}
      <div className="pointer-events-none relative z-10 flex items-start justify-between">
        <div>{product.badge ? <TopBadge badge={product.badge} /> : null}</div>
        <div className="pointer-events-auto">
          <FavoriteButton product={product} />
        </div>
      </div>

      {/* Image area */}
      <div className="pointer-events-none relative z-10 mt-2 grid h-[184px] place-items-center">
        {aiRecommended && (
          <span className="absolute left-0 top-0 z-10 inline-flex items-center gap-1 rounded-full bg-cc-primary px-2 py-0.5 text-[10px] font-bold text-white">
            <Sparkles className="h-2.5 w-2.5" strokeWidth={2} />
            CloudIA Pick
          </span>
        )}
        <Image
          src={product.image}
          alt={product.imageAlt}
          width={320}
          height={320}
          style={{ viewTransitionName: `product-image-${product.id}` } as React.CSSProperties}
          className="max-h-[168px] w-auto max-w-[88%] object-contain drop-shadow-[0_14px_20px_rgba(16,24,40,0.12)] transition-transform duration-[260ms] ease-cc-out group-hover:-translate-y-0.5 group-hover:scale-[1.025]"
        />
        {/* Quick action — compare toggle (reveals on hover, stays when active) */}
        <button
          type="button"
          aria-label={inCompare ? `Quitar ${product.name} del comparador` : `Comparar ${product.name}`}
          aria-pressed={inCompare}
          className={cn(
            "pointer-events-auto cc-focus-ring absolute bottom-2 right-1 grid h-[34px] w-[34px] place-items-center rounded-full border shadow-cc-sm transition-[opacity,transform,background,color] duration-[180ms] ease-cc-out",
            inCompare
              ? "border-cc-primary bg-cc-primary text-white opacity-100"
              : "translate-y-1 scale-95 border-cc-border bg-white/90 text-cc-primary opacity-0 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100",
          )}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            toggleCompare(product);
          }}
        >
          <Scale className="h-4 w-4" strokeWidth={1.9} />
        </button>
      </div>

      {/* Content */}
      <div className="pointer-events-none relative z-10 mt-1 flex flex-1 flex-col">
        <p className="text-xs font-bold leading-[1.2] text-cc-text">
          {product.brand}
        </p>
        <h3 className="cc-line-clamp-2 mt-0.5 min-h-[34px] text-[13px] font-medium leading-[1.28] text-cc-text">
          {product.name}
        </h3>

        {/* Rating (hidden until the product has reviews) */}
        {product.reviewCount > 0 && (
          <div className="mt-1 flex items-center gap-1 text-xs text-cc-secondary">
            <Star className="h-[13px] w-[13px] fill-cc-star text-cc-star" />
            <span className="font-semibold text-cc-text">
              {product.rating.toFixed(1)}
            </span>
            <span className="text-cc-muted">({product.reviewCount})</span>
          </div>
        )}

        {/* Features */}
        {product.features.length > 0 && (
          <ul className="mt-1.5 grid gap-1">
            {product.features.slice(0, 3).map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-1.5 text-[11.5px] text-cc-secondary"
              >
                <Check className="h-3 w-3 shrink-0 text-cc-primary" strokeWidth={2.4} />
                <span className="truncate">{feature}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Price */}
        <div className="mt-auto flex items-baseline gap-2 pt-2.5">
          <span className="text-[19px] font-extrabold leading-[1.1] tracking-[-0.025em] text-cc-text">
            {formatPrice(product.price)}
          </span>
          {product.oldPrice ? (
            <span className="text-xs text-cc-faint line-through">
              {formatPrice(product.oldPrice)}
            </span>
          ) : null}
        </div>

        {/* Wholesale hint (modo reventa) */}
        {product.wholesale && product.wholesale.price < product.price ? (
          <p className="mt-0.5 text-[11px] font-semibold text-cc-primary">
            {product.wholesale.minQuantity}+ u: {formatPrice(product.wholesale.price)} c/u
          </p>
        ) : null}

        {/* Shipping */}
        {product.shipping === "free" ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-cc-success">
            <Truck className="h-[15px] w-[15px]" strokeWidth={1.9} />
            Envío gratis
          </p>
        ) : null}

        <div className="pointer-events-auto">
          <AddToCartButton product={product} />
        </div>
      </div>
    </article>
  );
}
