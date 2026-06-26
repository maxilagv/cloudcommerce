import Link from "next/link";
import { ChevronRight } from "lucide-react";

type BreadcrumbItem = { label: string; href?: string };

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Navegación de migas de pan">
      <ol className="flex items-center flex-wrap gap-0.5 list-none p-0 m-0">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-0.5">
              {i > 0 && (
                <ChevronRight
                  className="h-3.5 w-3.5 text-cc-faint flex-shrink-0"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              )}
              {isLast || !item.href ? (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={
                    isLast
                      ? "text-[13px] text-cc-text font-medium max-w-[240px] truncate"
                      : "text-[13px] text-cc-muted"
                  }
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="text-[13px] text-cc-muted hover:text-cc-primary transition-colors duration-[140ms] ease-cc-out whitespace-nowrap"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
