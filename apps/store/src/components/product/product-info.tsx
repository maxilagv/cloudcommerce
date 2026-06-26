import { formatCOP } from "@/lib/utils";
import { AddToCartButton } from "./add-to-cart-button";
import { FavoriteButton } from "./favorite-button";
import { VariantSelector } from "./variant-selector";
import { QuantityCounter } from "./quantity-counter";
import { CompareButton, ShareRow } from "./product-actions";
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
      <div className="flex flex-wrap items-center gap-2">
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
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-[28px] font-black leading-none tracking-tight text-cc-text">
            {formatCOP(product.price)}
          </span>
          {product.oldPrice && (
            <span className="text-[16px] font-medium text-cc-muted line-through">
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
          <p className="mt-0.5 text-[12px] font-semibold text-cc-success">
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
        <p className="mb-2 text-[13px] font-medium text-cc-text">Cantidad</p>
        <QuantityCounter min={1} max={50} initial={1} />
      </div>

      {/* CTAs */}
      <div className="mt-1 flex flex-col gap-2.5">
        <AddToCartButton product={product} size="lg" />

        <div className="flex items-center gap-2">
          <FavoriteButton product={product} showLabel />
          <CompareButton product={product} />
        </div>
      </div>

      {/* Share row */}
      <ShareRow name={product.name} />
    </div>
  );
}
