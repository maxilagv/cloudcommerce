"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { staggerContainer } from "@/lib/motion";

/** Wraps a grid/list of section items so they stagger in once as the section
 *  scrolls into view — pair each child with a `motion.div variants={fadeSlideUp}`. */
export function RevealGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer(0.05)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
    >
      {children}
    </motion.div>
  );
}
