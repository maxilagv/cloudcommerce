"use client";

import Image from "next/image";
import { Minus, Plus, Trash2 } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { unitPriceFor } from "@/lib/catalog-types";
import { useCart } from "@/store/cart";
import type { CartItem as CartItemType } from "@/store/cart";

export function CartItem({ item }: { item: CartItemType }) {
  const { setQuantity, remove } = useCart();
  const { product, quantity } = item;

  const unitPrice = unitPriceFor(product, quantity);
  const wholesaleApplied = unitPrice < product.price;
  const missingForWholesale =
    product.wholesale && !wholesaleApplied && product.wholesale.price < product.price
      ? product.wholesale.minQuantity - quantity
      : 0;

  return (
    <div className="flex gap-3 py-4 border-b border-cc-border-subtle last:border-0">
      {/* Thumbnail */}
      <div className="h-16 w-16 shrink-0 rounded-cc-sm bg-cc-bg-surface-soft flex items-center justify-center overflow-hidden">
        <Image
          src={product.image}
          alt={product.imageAlt}
          width={64}
          height={64}
          className="h-14 w-14 object-contain"
        />
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1.5 min-w-0">
        <p className="text-[11px] font-bold text-cc-muted uppercase tracking-wide">
          {product.brand}
        </p>
        <p className="text-[13px] font-medium text-cc-text leading-snug line-clamp-2">
          {product.name}
        </p>
        <p className="text-[15px] font-extrabold text-cc-text tracking-tight">
          {formatPrice(unitPrice * quantity)}
        </p>
        {quantity > 1 && (
          <p className="text-[11px] text-cc-muted">
            {formatPrice(unitPrice)} c/u
            {wholesaleApplied && (
              <span className="ml-1.5 font-bold text-cc-success">· precio mayorista</span>
            )}
          </p>
        )}
        {missingForWholesale > 0 && missingForWholesale <= 3 && (
          <p className="text-[11px] font-semibold text-cc-primary">
            Sumá {missingForWholesale} más y pagás {formatPrice(product.wholesale!.price)} c/u
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col items-end justify-between shrink-0">
        <button
          type="button"
          onClick={() => remove(product.id)}
          aria-label={`Eliminar ${product.name}`}
          className="text-cc-muted hover:text-cc-danger transition-colors duration-[140ms] p-1 rounded-cc-xs cc-focus-ring"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.8} />
        </button>

        <div className="flex items-center gap-1.5 rounded-full border border-cc-border bg-cc-bg-surface-soft px-1 py-0.5">
          <button
            type="button"
            aria-label="Reducir cantidad"
            onClick={() => setQuantity(product.id, quantity - 1)}
            className={cn(
              "grid h-6 w-6 place-items-center rounded-full text-cc-secondary transition-colors duration-[140ms] cc-focus-ring",
              quantity <= 1
                ? "text-cc-muted cursor-not-allowed"
                : "hover:bg-cc-primary-soft hover:text-cc-primary",
            )}
            disabled={quantity <= 1}
          >
            <Minus className="h-3 w-3" strokeWidth={2.2} />
          </button>
          <span className="w-5 text-center text-[13px] font-bold text-cc-text">
            {quantity}
          </span>
          <button
            type="button"
            aria-label="Aumentar cantidad"
            onClick={() => setQuantity(product.id, quantity + 1)}
            className="grid h-6 w-6 place-items-center rounded-full text-cc-secondary transition-colors duration-[140ms] hover:bg-cc-primary-soft hover:text-cc-primary cc-focus-ring"
          >
            <Plus className="h-3 w-3" strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  );
}
