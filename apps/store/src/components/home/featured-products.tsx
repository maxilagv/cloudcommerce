import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShoppingCart, Star } from "lucide-react";
import { homeFeaturedProducts } from "@/lib/home-data";
import { formatCOP } from "@/lib/utils";
import { SectionHeading } from "./section-heading";

export function FeaturedProducts() {
  return (
    <section aria-labelledby="home-featured-products-title" className="mt-8">
      <SectionHeading
        eyebrow="Destacados"
        title="Productos elegidos para empezar"
        description="Una muestra compacta del catalogo para descubrir tecnologia sin convertir la home en una grilla infinita."
        href="/products"
        linkLabel="Explorar catalogo"
      />
      <div className="cc-no-scrollbar grid gap-3 overflow-x-auto sm:grid-cols-2 xl:grid-cols-3">
        {homeFeaturedProducts.map((product) => (
          <Link
            key={product.id}
            href={product.href}
            className="cc-focus-ring group flex min-h-[142px] min-w-[290px] items-center gap-4 rounded-[20px] border border-cc-border bg-white p-3 shadow-cc-xs transition-[transform,border-color,box-shadow] duration-[220ms] ease-cc-out hover:-translate-y-[3px] hover:border-cc-primary-border hover:shadow-cc-md"
          >
            <span className="grid h-[104px] w-[104px] shrink-0 place-items-center rounded-cc-lg bg-cc-soft">
              <Image
                src={product.image.src}
                alt={product.image.alt}
                width={product.image.width}
                height={product.image.height}
                sizes="104px"
                className="max-h-[86px] w-auto object-contain drop-shadow-[0_14px_18px_rgba(16,24,40,.12)] transition-transform duration-[260ms] ease-cc-out group-hover:-translate-y-0.5 group-hover:scale-[1.025]"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="inline-flex rounded-full bg-cc-primary-soft px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-cc-primary">
                {product.badge}
              </span>
              <span className="mt-2 block text-[12px] font-extrabold uppercase tracking-[0.08em] text-cc-muted">
                {product.brand}
              </span>
              <span className="cc-line-clamp-2 mt-0.5 block text-[14px] font-bold leading-5 text-cc-text">
                {product.name}
              </span>
              {product.rating ? (
                <span className="mt-1 flex items-center gap-1 text-[12px] text-cc-secondary">
                  <Star className="h-3.5 w-3.5 fill-cc-star text-cc-star" />
                  <strong className="text-cc-text">{product.rating.value.toFixed(1)}</strong>
                  <span>({product.rating.count})</span>
                </span>
              ) : null}
              <span className="mt-1.5 flex items-center justify-between gap-3">
                <strong className="text-[18px] font-black tracking-[-0.035em] text-cc-text">
                  {formatCOP(product.price)}
                </strong>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cc-primary text-white shadow-[0_10px_18px_rgba(11,107,255,.22)] transition-transform duration-[180ms] group-hover:scale-[1.04]">
                  <ShoppingCart className="h-4 w-4" strokeWidth={2} />
                </span>
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
