import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export type BadgeTone = "success" | "info" | "warning" | "danger" | "muted";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Render the leading dot marker. Defaults to true. */
  dot?: boolean;
}

export function Badge({ tone = "muted", dot = true, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn("ui-badge", `ui-badge--${tone}`, dot && "ui-badge--dot", className)} {...props}>
      {children}
    </span>
  );
}
