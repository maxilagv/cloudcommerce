import Link from "next/link";
import { homeBrands } from "@/lib/home-data";
import { SectionHeading } from "./section-heading";

export function BrandStrip() {
  return (
    <section aria-labelledby="home-brands-title" className="mt-8">
      <SectionHeading
        eyebrow="Marcas lideres"
        title="Tecnologia confiable en un solo lugar"
        href="/products"
        linkLabel="Ver todas"
      />
      <div className="cc-no-scrollbar flex gap-3 overflow-x-auto rounded-[22px] border border-cc-border bg-white p-3 shadow-cc-xs">
        {homeBrands.map((brand) => (
          <Link
            key={brand.id}
            href={brand.href}
            className="cc-focus-ring flex h-14 min-w-[124px] items-center justify-center rounded-cc-lg border border-cc-border-subtle bg-cc-soft px-4 text-[15px] font-black tracking-[-0.02em] text-cc-secondary opacity-80 transition-[transform,opacity,border-color,color] duration-[180ms] ease-cc-out hover:-translate-y-px hover:border-cc-primary-border hover:text-cc-text hover:opacity-100"
          >
            {brand.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
