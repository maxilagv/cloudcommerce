"use client";

import { MotionConfig, type Transition, type Variants } from "motion/react";
import type { ReactNode } from "react";

/**
 * Shared motion presets — the only place spring physics and shared variants
 * are defined for the store. Components import from here instead of
 * hand-rolling transitions, so motion stays consistent across the app.
 */
export const spring = {
  /** UI responding directly to a gesture: drawers, drags, toggles. */
  snappy: { type: "spring", stiffness: 400, damping: 30 } satisfies Transition,
  /** Layout reflow, lists reordering, page-level transitions. */
  gentle: { type: "spring", stiffness: 260, damping: 26 } satisfies Transition,
  /** Rare delight moments only: badge pop, success states. */
  bouncy: { type: "spring", stiffness: 500, damping: 15 } satisfies Transition,
} as const;

export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
  },
};

export const staggerContainer = (staggerChildren = 0.04, delayChildren = 0): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren, delayChildren },
  },
});

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
