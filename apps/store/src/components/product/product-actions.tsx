"use client";

import { ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompare } from "@/store/compare";
import { toast } from "@/store/toast";
import type { ProductCardData } from "@/lib/catalog-types";

export function CompareButton({ product }: { product: ProductCardData }) {
  const toggle = useCompare((s) => s.toggle);
  const inCompare = useCompare((s) => s.has(product.id));

  return (
    <button
      type="button"
      onClick={() => toggle(product)}
      aria-pressed={inCompare}
      className={cn(
        "cc-focus-ring flex h-12 flex-shrink-0 items-center gap-1.5 rounded-cc-xs px-3 text-[13px] font-medium transition-colors duration-[140ms]",
        inCompare ? "text-cc-primary" : "text-cc-primary hover:underline",
      )}
    >
      <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={1.8} />
      {inCompare ? "En comparador" : "Comparar"}
    </button>
  );
}

const SHARE = [
  { id: "facebook", label: "Facebook", glyph: "f" },
  { id: "twitter", label: "Twitter", glyph: "𝕏" },
  { id: "copy", label: "Copiar enlace", glyph: "⎘" },
] as const;

export function ShareRow({ name }: { name: string }) {
  function share(id: (typeof SHARE)[number]["id"]) {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (id === "facebook") {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        "_blank",
        "noopener,noreferrer",
      );
    } else if (id === "twitter") {
      window.open(
        `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(name)}`,
        "_blank",
        "noopener,noreferrer",
      );
    } else {
      navigator.clipboard?.writeText(url).then(
        () => toast.success("Enlace copiado"),
        () => toast.error("No se pudo copiar el enlace"),
      );
    }
  }

  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-[12px] text-cc-muted">Compartir:</span>
      <div className="flex items-center gap-2">
        {SHARE.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-label={s.label}
            onClick={() => share(s.id)}
            className="cc-focus-ring flex h-7 w-7 items-center justify-center rounded-full border border-cc-border text-[11px] font-bold text-cc-muted transition-colors duration-[140ms] hover:border-cc-primary-border hover:text-cc-primary"
          >
            {s.glyph}
          </button>
        ))}
      </div>
    </div>
  );
}
