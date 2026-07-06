import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { HomeCollection } from "@/lib/home-data";
import { SectionHeading } from "./section-heading";

export function CuratedCollections({ collections }: { collections: HomeCollection[] }) {
  if (collections.length === 0) return null;
  return (
    <section aria-labelledby="home-collections-title" className="mt-8">
      <SectionHeading
        eyebrow="Colecciones curadas"
        title="Comprá por intención, no por lista"
        description="Accesos editoriales para resolver necesidades concretas del catálogo real."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {collections.map(({ id, title, description, href, image, icon: Icon }) => (
          <Link
            key={id}
            href={href}
            className="cc-focus-ring group relative min-h-[190px] overflow-hidden rounded-[24px] border border-cc-border bg-gradient-to-br from-white to-cc-primary-softer p-5 shadow-cc-xs transition-[transform,border-color,box-shadow] duration-[220ms] ease-cc-out hover:-translate-y-[3px] hover:border-cc-primary-border hover:shadow-cc-md"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-cc-primary shadow-cc-xs">
              <Icon className="h-5 w-5" strokeWidth={2} />
            </span>
            <h3 className="mt-5 max-w-[210px] text-[22px] font-black tracking-[-0.04em] text-cc-text">{title}</h3>
            <p className="mt-2 max-w-[230px] text-sm leading-6 text-cc-secondary">{description}</p>
            <span className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-cc-primary text-white transition-transform duration-[180ms] group-hover:rotate-12 group-hover:scale-[1.04]">
              <ArrowUpRight className="h-5 w-5" />
            </span>
            {image ? (
              <Image
                src={image.src}
                alt={image.alt}
                width={image.width}
                height={image.height}
                sizes="(min-width: 1024px) 24vw, 72vw"
                className="absolute -bottom-7 -right-5 max-h-[150px] w-auto max-w-[44%] object-contain drop-shadow-[0_18px_24px_rgba(16,24,40,.14)] transition-transform duration-[260ms] ease-cc-out group-hover:scale-[1.035]"
              />
            ) : (
              <span className="absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-cc-primary/8 transition-transform duration-[260ms] ease-cc-out group-hover:scale-110" />
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
