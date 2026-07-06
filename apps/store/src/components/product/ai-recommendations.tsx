import { Sparkles } from "lucide-react";
import type { ProductCardData } from "@/lib/catalog-types";
import { ProductCard } from "./card";

export function AiRecommendations({ products }: { products: ProductCardData[] }) {
  const aiPicks = products.slice(0, 4);
  if (aiPicks.length === 0) return null;

  return (
    <section className="mt-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-cc-sm bg-cc-primary flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-[15px] font-bold text-cc-text leading-tight">
              CloudIA recomienda
            </h2>
            <p className="text-[11px] text-cc-muted">Seleccionado especialmente para vos</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-cc-primary-soft border border-cc-primary-border text-[11px] font-bold text-cc-primary">
          <Sparkles className="h-2.5 w-2.5" strokeWidth={2} />
          IA
        </span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {aiPicks.map((product) => (
          <ProductCard key={product.id} product={product} aiRecommended />
        ))}
      </div>
    </section>
  );
}
