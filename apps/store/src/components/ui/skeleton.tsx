import { cn } from "@/lib/utils";

type SkeletonVariant = "text" | "card" | "image" | "avatar" | "chart";

const VARIANT_CLASS: Record<SkeletonVariant, string> = {
  text: "h-4 rounded-cc-xs",
  card: "rounded-cc-lg",
  image: "rounded-cc-md aspect-square",
  avatar: "rounded-full",
  chart: "rounded-cc-md",
};

interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
}

/** Shimmering placeholder matching the real content's geometry — never a generic spinner. */
export function Skeleton({ variant = "text", className }: SkeletonProps) {
  return <div className={cn("cc-skeleton", VARIANT_CLASS[variant], className)} aria-hidden="true" />;
}
