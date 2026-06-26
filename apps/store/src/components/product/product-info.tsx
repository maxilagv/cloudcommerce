import { ArrowLeftRight } from "lucide-react";
import { formatCOP } from "@/lib/utils";
import { AddToCartButton } from "./add-to-cart-button";
import { FavoriteButton } from "./favorite-button";
import { VariantSelector } from "./variant-selector";
import { QuantityCounter } from "./quantity-counter";
import type { ProductDetailData } from "@/lib/mock-product-detail";

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          width={14}
          height={14}
          viewBox="0 0 14 14"
          fill={n <= Math.round(rating) ? "var(--cc-star)" : "var(--cc-border-strong)"}
        >
          <path d="M7 1l1.545 3.13L12 4.635l-2.5 2.435.59 3.44L7 8.885l-3.09 1.625.59-3.44L2 4.635l3.455-.505z" />
        </svg>
      ))}
    </span>
  );
}

export function ProductInfo({ product }: { product: ProductDetailData }) {
  const savings = product.oldPrice ? product.oldPrice - product.price : undefined;
  const savingsPct = product.oldPrice
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* Brand chip */}
      <span className="inline-flex items-center self-start rounded-full bg-cc-primary-soft px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-cc-primary">
        {product.brand}
      </span>

      {/* Product name */}
      <h1 id="product-title" className="text-[22px] font-bold leading-tight text-cc-text">
        {product.name}
      </h1>

      {/* Rating + SKU */}
      <div className="flex items-center flex-wrap gap-2">
        <StarRow rating={product.rating} />
        <span className="text-[13px] font-bold text-cc-text">
          {product.rating.toFixed(1)}
        </span>
        <a
          href="#tab-reviews"
          className="text-[13px] text-cc-primary hover:underline"
        >
          {product.reviewCount.toLocaleString("es-CO")} opiniones
        </a>
        {product.sku && (
          <>
            <span className="text-cc-faint">·</span>
            <span className="text-[12px] text-cc-muted">SKU: {product.sku}</span>
          </>
        )}
      </div>

      {/* Price block */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-[28px] font-black text-cc-text leading-none tracking-tight">
            {formatCOP(product.price)}
          </span>
          {product.oldPrice && (
            <span className="text-[16px] text-cc-muted line-through font-medium">
              {formatCOP(product.oldPrice)}
            </span>
          )}
        </div>
        {savings && savingsPct && (
          <p className="text-[13px] font-semibold text-cc-success">
            Ahorras {formatCOP(savings)} ({savingsPct}% OFF)
          </p>
        )}
        {product.shipping === "free" && (
          <p className="text-[12px] font-semibold text-cc-success mt-0.5">
            ✓ Envío gratis incluido
          </p>
        )}
      </div>

      <hr className="border-cc-border-subtle" />

      {/* Variants */}
      <VariantSelector
        colorVariants={product.colorVariants}
        capacityVariants={product.capacityVariants}
        defaultColor={product.activeColor}
        defaultCapacity={product.activeCapacity}
      />

      <hr className="border-cc-border-subtle" />

      {/* Quantity */}
      <div>
        <p className="text-[13px] font-medium text-cc-text mb-2">Cantidad</p>
        <QuantityCounter min={1} max={50} initial={1} />
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-2.5 mt-1">
        <AddToCartButton productName={product.name} size="lg" />

        <div className="flex gap-2 items-center">
          <FavoriteButton
            productName={product.name}
            initial={product.isFavorite}
            showLabel
          />
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 text-[13px] text-cc-primary font-medium hover:underline cc-focus-ring rounded-cc-xs h-12 flex-shrink-0"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={1.8} />
            Comparar
          </button>
        </div>
      </div>

      {/* Share row */}
      <div className="flex items-center gap-3 pt-1">
        <span className="text-[12px] text-cc-muted">Compartir:</span>
        <div className="flex items-center gap-2">
          {[
            { label: "Facebook", glyph: "f" },
            { label: "Twitter", glyph: "𝕏" },
            { label: "Copiar enlace", glyph: "⎘" },
          ].map((s) => (
            <button
              key={s.label}
              type="button"
              aria-label={s.label}
              className="h-7 w-7 rounded-full border border-cc-border flex items-center justify-center text-[11px] font-bold text-cc-muted hover:text-cc-primary hover:border-cc-primary-border transition-colors duration-[140ms] cc-focus-ring"
            >
              {s.glyph}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
