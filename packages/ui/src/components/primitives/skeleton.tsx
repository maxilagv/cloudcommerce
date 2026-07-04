import type { CSSProperties } from "react";
import { cn } from "../../lib/cn";

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  className?: string;
}

/** Shimmer placeholder. Give it the shape of the content it replaces. */
export function Skeleton({ width, height = 14, radius, className }: SkeletonProps) {
  const style: CSSProperties = {
    width: width ?? "100%",
    height,
    ...(radius !== undefined ? { borderRadius: radius } : {}),
  };
  return <span className={cn("ui-skeleton", className)} style={style} aria-hidden />;
}
