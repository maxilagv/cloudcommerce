import type { ProductCardData } from "@/lib/catalog-types";
import { ProductCard } from "./card";

/** Responsive product grid — 2/3/4 columns (estetica.md §14: no 3-col on wide desktop). */
export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <div className="cc-stagger grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
