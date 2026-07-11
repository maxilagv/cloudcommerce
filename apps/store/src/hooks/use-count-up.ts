"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "motion/react";

/** Tweens a numeric value and formats it on every frame — e.g. a price that
 *  should count up/down smoothly instead of jumping to the new total. */
export function useCountUp(value: number, format: (n: number) => string, duration = 0.2) {
  const [display, setDisplay] = useState(() => format(value));
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;
    if (from === value) {
      setDisplay(format(value));
      return;
    }
    const controls = animate(from, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplay(format(Math.round(latest))),
    });
    return () => controls.stop();
  }, [value, format, duration]);

  return display;
}
