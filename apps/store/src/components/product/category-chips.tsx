import Link from "next/link";
import { categoryHref, type CategoryLink } from "@/lib/catalog-types";
import { cn } from "@/lib/utils";

/**
 * Category navigation chips. Each chip is a real crawlable link to the
 * category landing (`/products?category=slug`) — the server narrows the
 * product list and emits category-specific metadata.
 */
export function CategoryChips({
  categories,
  activeCategorySlug,
}: {
  categories: CategoryLink[];
  activeCategorySlug?: string;
}) {
  if (categories.length === 0) return null;

  const chipClass = (isActive: boolean) =>
    cn(
      "cc-focus-ring shrink-0 rounded-full border px-4 py-2 text-[13px] font-medium",
      "transition-[transform,background,border-color,color,box-shadow] duration-[180ms] ease-cc-out",
      isActive
        ? "border-cc-primary bg-cc-primary text-white shadow-[0_8px_18px_rgba(11,107,255,0.22)]"
        : "border-cc-border bg-cc-surface text-cc-secondary hover:-translate-y-px hover:border-cc-primary-border hover:text-cc-text hover:shadow-cc-sm",
    );

  return (
    <nav
      aria-label="Categorías"
      className="cc-no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1"
    >
      <Link
        href="/products#catalogo"
        aria-current={!activeCategorySlug ? "page" : undefined}
        className={chipClass(!activeCategorySlug)}
      >
        Todo
      </Link>
      {categories.map((category) => {
        const isActive = category.slug === activeCategorySlug;
        return (
          <Link
            key={category.slug}
            href={`${categoryHref(category.slug)}#catalogo`}
            aria-current={isActive ? "page" : undefined}
            className={chipClass(isActive)}
          >
            {category.label}
          </Link>
        );
      })}
    </nav>
  );
}
