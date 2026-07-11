"use client";

import { motion } from "motion/react";
import type { ProductCardData } from "@/lib/catalog-types";
import { staggerContainer, fadeSlideUp } from "@/lib/motion";
import { ProductCard } from "./card";

/** Responsive product grid — 2/3/4 columns (estetica.md §14: no 3-col on wide desktop).
 *  Entry stagger plays once as the grid scrolls into view. */
export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <motion.div
      className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4"
      variants={staggerContainer(0.04)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
    >
      {products.map((product) => (
        <motion.div key={product.id} variants={fadeSlideUp}>
          <ProductCard product={product} />
        </motion.div>
      ))}
    </motion.div>
  );
}
