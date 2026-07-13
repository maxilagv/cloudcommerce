"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

export function ImageGallery({
  images,
  productName,
  productId,
}: {
  images: string[];
  productName: string;
  /** Matches the view-transition-name set on the ProductCard image so the
   *  product photo morphs from grid to detail (see use-view-transition-navigate). */
  productId?: string;
}) {
  const [activeIdx, setActiveIdx] = useState(0);

  return (
    <div className="flex gap-3">
      {/* Thumbnails column */}
      <div className="flex flex-col gap-2 w-[70px] flex-shrink-0">
        {images.map((src, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Ver imagen ${i + 1} de ${productName}`}
            aria-pressed={activeIdx === i}
            onClick={() => setActiveIdx(i)}
            className={cn(
              "h-[70px] w-[70px] rounded-cc-sm border-2 bg-white overflow-hidden flex-shrink-0",
              "transition-[transform,border-color,box-shadow] duration-[140ms] ease-cc-out hover:-translate-y-px hover:scale-[1.02]",
              "cc-focus-ring",
              activeIdx === i
                ? "border-cc-primary shadow-[0_0_0_3px_rgba(11,107,255,0.12)]"
                : "border-cc-border hover:border-cc-primary-border",
            )}
          >
            <Image
              src={src}
              alt={`Vista ${i + 1}`}
              width={70}
              height={70}
              className="object-contain w-full h-full p-1"
            />
          </button>
        ))}
      </div>

      {/* Main image — crossfades between thumbnails instead of a hard cut */}
      <div className="relative flex-1 min-h-[380px] max-h-[520px] bg-white rounded-cc-xl border border-cc-border overflow-hidden group">
        <AnimatePresence mode="sync">
          <motion.div
            key={activeIdx}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <Image
              src={images[activeIdx] ?? images[0]}
              alt={productName}
              fill
              data-fly-image={productId}
              style={
                activeIdx === 0 && productId
                  ? ({ viewTransitionName: `product-image-${productId}` } as React.CSSProperties)
                  : undefined
              }
              className={cn(
                "object-contain p-8",
                "transition-transform duration-[300ms] ease-cc-out",
                "group-hover:scale-[1.03]",
              )}
              priority
            />
          </motion.div>
        </AnimatePresence>

        {/* Zoom hint */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-white/80 backdrop-blur-sm px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-[200ms] shadow-cc-xs border border-cc-border-subtle">
          <ZoomIn className="h-3.5 w-3.5 text-cc-muted" strokeWidth={1.8} />
          <span className="text-[11px] text-cc-muted font-medium">Ampliar</span>
        </div>
      </div>
    </div>
  );
}
