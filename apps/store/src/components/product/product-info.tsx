"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { BadgePercent, Star } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { unitPriceFor } from "@/lib/catalog-types";
import { AddToCartButton } from "./add-to-cart-button";
import { FavoriteButton } from "./favorite-button";
import { VariantSelector } from "./variant-selector";
import { QuantityCounter } from "./quantity-counter";
import { CompareButton, ShareRow } from "./product-actions";
import type { ProductDetailData } from "@/lib/product-detail-types";

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

export function ProductInfo({
  product,
  pointsPer1000 = 0,
}: {
  product: ProductDetailData;
  /** Tasa pública de CloudPoints (0 = programa apagado / no disponible). */
  pointsPer1000?: number;
}) {
  const [quantity, setQuantity] = useState(1);

  const wholesale = product.wholesale ?? null;
  const unitPrice = unitPriceFor(product, quantity);
  const wholesaleApplied = wholesale !== null && quantity >= wholesale.minQuantity;
  const lineTotal = unitPrice * quantity;

  // Ahorro mostrado: contra el precio de lista (oldPrice) en minorista, o
  // contra el precio minorista cuando el tramo mayorista está aplicado.
  const referencePrice = wholesaleApplied ? product.price : (product.oldPrice ?? null);
  const savingsPerUnit = referencePrice ? referencePrice - unitPrice : 0;
  const savingsPct = referencePrice
    ? Math.round(((referencePrice - unitPrice) / referencePrice) * 100)
    : 0;

  const pointsEarned =
    pointsPer1000 > 0 ? Math.floor(lineTotal / 1000) * pointsPer1000 : 0;

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

      {/* Rating + SKU (rating hidden until the product has reviews) */}
      <div className="flex flex-wrap items-center gap-2">
        {product.reviewCount > 0 && (
          <>
            <StarRow rating={product.rating} />
            <span className="text-[13px] font-bold text-cc-text">
              {product.rating.toFixed(1)}
            </span>
            <a
              href="#tab-reviews"
              className="text-[13px] text-cc-primary hover:underline"
            >
              {product.reviewCount.toLocaleString("es-AR")} opiniones
            </a>
          </>
        )}
        {product.sku && (
          <>
            {product.reviewCount > 0 && <span className="text-cc-faint">·</span>}
            <span className="text-[12px] text-cc-muted">SKU: {product.sku}</span>
          </>
        )}
      </div>

      {/* Price block — reacts to the selected quantity */}
      <div className="flex flex-col gap-0.5" aria-live="polite">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-[28px] font-black leading-none tracking-tight text-cc-text tabular-nums">
            {formatPrice(unitPrice)}
          </span>
          {referencePrice && referencePrice > unitPrice && (
            <span className="text-[16px] font-medium text-cc-muted line-through tabular-nums">
              {formatPrice(referencePrice)}
            </span>
          )}
          {wholesaleApplied && (
            <span className="inline-flex items-center gap-1 rounded-full bg-cc-success-soft px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-cc-success animate-[cc-badge-pop_300ms_ease-cc-spring]">
              <BadgePercent className="h-3 w-3" /> Precio mayorista
            </span>
          )}
        </div>
        {savingsPerUnit > 0 && savingsPct > 0 && (
          <p className="text-[13px] font-semibold text-cc-success">
            Ahorrás {formatPrice(savingsPerUnit)} por unidad ({savingsPct}% OFF)
          </p>
        )}
        {quantity > 1 && (
          <p className="text-[13px] text-cc-secondary">
            Total por {quantity} unidades:{" "}
            <strong className="text-cc-text tabular-nums">{formatPrice(lineTotal)}</strong>
          </p>
        )}
        {product.shipping === "free" && (
          <p className="mt-0.5 text-[12px] font-semibold text-cc-success">
            ✓ Envío gratis incluido
          </p>
        )}
      </div>

      {/* Tabla de precios por cantidad (modo reventa) */}
      {wholesale && wholesale.price < product.price && (
        <div
          role="group"
          aria-label="Precios por cantidad"
          className="overflow-hidden rounded-cc-lg border border-cc-border"
        >
          <button
            type="button"
            onClick={() => setQuantity(1)}
            className={cn(
              "cc-focus-ring relative flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[13px]",
              wholesaleApplied && "hover:bg-cc-soft",
            )}
          >
            {!wholesaleApplied && (
              <motion.span
                layoutId="wholesale-active-row"
                transition={spring.snappy}
                className="absolute inset-0 -z-10 bg-cc-primary-soft"
              />
            )}
            <span className={cn("font-semibold transition-colors duration-150", !wholesaleApplied ? "text-cc-primary" : "text-cc-secondary")}>
              1 a {wholesale.minQuantity - 1} unidades
            </span>
            <span className="font-bold tabular-nums text-cc-text">
              {formatPrice(product.price)} <span className="text-[11px] font-medium text-cc-muted">c/u</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setQuantity(wholesale.minQuantity)}
            className={cn(
              "cc-focus-ring relative flex w-full items-center justify-between border-t border-cc-border-subtle px-3.5 py-2.5 text-left text-[13px]",
              !wholesaleApplied && "hover:bg-cc-soft",
            )}
          >
            {wholesaleApplied && (
              <motion.span
                layoutId="wholesale-active-row"
                transition={spring.snappy}
                className="absolute inset-0 -z-10 bg-cc-success-soft"
              />
            )}
            <span className={cn("font-semibold transition-colors duration-150", wholesaleApplied ? "text-cc-success" : "text-cc-secondary")}>
              {wholesale.minQuantity}+ unidades · mayorista
            </span>
            <span className="font-bold tabular-nums text-cc-text">
              {formatPrice(wholesale.price)} <span className="text-[11px] font-medium text-cc-muted">c/u</span>
            </span>
          </button>
        </div>
      )}

      <hr className="border-cc-border-subtle" />

      {/* Variants (hidden when the product has none) */}
      {(product.colorVariants.length > 0 || product.capacityVariants.length > 0) && (
        <>
          <VariantSelector
            colorVariants={product.colorVariants}
            capacityVariants={product.capacityVariants}
            defaultColor={product.activeColor}
            defaultCapacity={product.activeCapacity}
          />
          <hr className="border-cc-border-subtle" />
        </>
      )}

      {/* Quantity */}
      <div>
        <p className="mb-2 text-[13px] font-medium text-cc-text">Cantidad</p>
        <QuantityCounter min={1} max={99} value={quantity} onChange={setQuantity} />
        {wholesale && !wholesaleApplied && wholesale.price < product.price && (
          <p className="mt-2 text-[12px] font-semibold text-cc-primary">
            Llevando {wholesale.minQuantity} pagás {formatPrice(wholesale.price)} c/u y ahorrás{" "}
            {formatPrice((product.price - wholesale.price) * wholesale.minQuantity)} en total.
          </p>
        )}
      </div>

      {/* CloudPoints que suma esta compra */}
      {pointsEarned > 0 && (
        <p className="flex items-center gap-1.5 rounded-cc-md bg-cc-primary-softer px-3 py-2 text-[12.5px] font-semibold text-cc-primary">
          <Star className="h-3.5 w-3.5" fill="currentColor" />
          Con esta compra sumás {pointsEarned.toLocaleString("es-AR")} CloudPoints al entregarse.
        </p>
      )}

      {/* CTAs */}
      <div className="mt-1 flex flex-col gap-2.5">
        <AddToCartButton product={product} size="lg" quantity={quantity} />

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
