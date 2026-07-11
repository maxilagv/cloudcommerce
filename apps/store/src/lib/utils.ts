import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with proper precedence. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a value as Argentine pesos: 5299900 -> "$ 5.299.900". */
export function formatPrice(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace(/ /g, " ");
}

/** Shared blur placeholder for remote product/promo images — a flat tint in
 *  the skeleton's own color, so `placeholder="blur"` works without a
 *  per-image blurDataURL pipeline. */
export const BLUR_DATA_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='8' height='8' fill='%23f1f4f8'/%3E%3C/svg%3E";
