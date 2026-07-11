"use client";

import { useEffect, useState } from "react";
import { useMotionTemplate, useMotionValue, useSpring, useTransform } from "motion/react";
import { spring } from "@/lib/motion";

/**
 * 3D tilt driven by cursor position within the target element (±maxDeg),
 * plus a specular highlight that follows the same coordinates. Inert on
 * touch/coarse-pointer devices and when prefers-reduced-motion is set.
 */
export function useTilt3d(maxDeg = 6) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setEnabled(
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [maxDeg, -maxDeg]), spring.gentle);
  const rotateY = useSpring(useTransform(px, [0, 1], [-maxDeg, maxDeg]), spring.gentle);
  const highlight = useMotionTemplate`radial-gradient(circle at ${useTransform(px, (v) => `${v * 100}%`)} ${useTransform(py, (v) => `${v * 100}%`)}, rgba(255,255,255,0.55), transparent 60%)`;

  function onMouseMove(e: React.MouseEvent<HTMLElement>) {
    if (!enabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width);
    py.set((e.clientY - rect.top) / rect.height);
  }
  function onMouseLeave() {
    px.set(0.5);
    py.set(0.5);
  }

  return { enabled, rotateX, rotateY, highlight, onMouseMove, onMouseLeave };
}
