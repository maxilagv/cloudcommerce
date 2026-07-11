import Link from "next/link";
import { Search } from "lucide-react";
import { getStoreCategories } from "@/lib/api/catalog";
import { categoryHref } from "@/lib/catalog-types";

/** "Lost cloud" mark — a softened version of the brand cloud, drifting off-course. */
function LostCloudIllustration() {
  return (
    <div className="relative mx-auto grid h-32 w-32 place-items-center">
      <div className="absolute inset-0 rounded-full bg-cc-primary-soft" />
      <svg
        width="72"
        height="72"
        viewBox="0 0 512 512"
        fill="none"
        className="relative animate-cc-float"
      >
        <path
          d="M354 322c36 0 66-29 66-65 0-33-25-61-58-65-8-54-55-96-111-96-49 0-91 31-106 75-38 4-67 36-67 74 0 42 34 77 76 77h200z"
          stroke="var(--cc-primary)"
          strokeWidth="26"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.55}
        />
        <path
          d="M180 380l16 16m0-16l-16 16m180-16l16 16m0-16l-16 16"
          stroke="var(--cc-primary)"
          strokeWidth="20"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/** Shared 404 body: illustration, search, and real category links. Used by both
 *  app/not-found.tsx (unmatched URLs, no AppShell) and app/(shop)/not-found.tsx
 *  (in-app notFound(), rendered inside AppShell). */
export async function NotFoundContent() {
  const categories = (await getStoreCategories()).filter((c) => c.isActive).slice(0, 6);

  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-center px-4 py-20 text-center sm:py-28">
      <LostCloudIllustration />

      <h1 className="mt-6 text-[28px] font-black tracking-[-0.03em] text-cc-text sm:text-[34px]">
        Esta página se perdió en la nube
      </h1>
      <p className="mt-2 max-w-[420px] text-[15px] text-cc-secondary">
        No encontramos lo que buscabas. Probá una búsqueda o volvé al catálogo.
      </p>

      <form action="/products" method="GET" className="mt-6 flex w-full max-w-[380px]">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cc-muted" />
          <input
            type="text"
            name="q"
            placeholder="Buscar productos"
            className="cc-focus-ring h-12 w-full rounded-full border border-cc-border bg-white pl-10 pr-4 text-[14px] text-cc-text placeholder:text-cc-muted"
          />
        </div>
        <button
          type="submit"
          className="cc-focus-ring ml-2 flex h-12 items-center justify-center rounded-full bg-cc-primary px-6 text-[14px] font-bold text-white transition-colors hover:bg-cc-primary-hover"
        >
          Buscar
        </button>
      </form>

      <Link
        href="/"
        className="cc-focus-ring mt-5 rounded-full px-5 py-2 text-[13px] font-semibold text-cc-primary hover:underline"
      >
        Volver al inicio
      </Link>

      {categories.length > 0 && (
        <div className="mt-10 w-full border-t border-cc-border-subtle pt-6">
          <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-cc-muted">
            O explorá una categoría
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={categoryHref(category.slug)}
                className="cc-focus-ring rounded-full border border-cc-border bg-white px-4 py-2 text-[13px] font-semibold text-cc-text transition-colors duration-[140ms] hover:border-cc-primary-border hover:text-cc-primary"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
