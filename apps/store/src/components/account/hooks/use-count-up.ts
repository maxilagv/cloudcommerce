"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

/** Counts a value from zero on first appearance, then from its previous value. */
export function useCountUp(value: number, duration = 0.6) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const previous = useRef(0);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;

    if (reduceMotion) {
      setDisplay(value);
      return;
    }

    const controls = animate(from, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });

    return () => controls.stop();
  }, [duration, reduceMotion, value]);

  return display;
}
