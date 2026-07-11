"use client";

import { motion } from "motion/react";
import { fadeSlideUp } from "@/lib/motion";

/**
 * Re-mounts on every navigation within (shop) (unlike layout.tsx, which
 * persists) — that's what lets this replay an entry animation per page.
 * Entry-only: exit animations here would block navigation in the App Router.
 */
export default function ShopTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial="hidden" animate="visible" variants={fadeSlideUp}>
      {children}
    </motion.div>
  );
}
