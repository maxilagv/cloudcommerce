import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { HomeCategory } from "@/lib/home-data";
import { SectionHeading } from "./section-heading";

const accentClass = {
  blue: "from-white to-cc-primary-softer",
  cyan: "from-white to-[#EFFBFF]",
  neutral: "from-white to-[#F8FAFD]",
};

export function CategoryShowcase({ categories }: { categories: HomeCategory[] }) {
  if (categories.length === 0) return null;
  return (
    <section id="home-categories" aria-labelledby="home-categories-title" className="mt-8">
      <SectionHeading
        eyebrow="Explorá por categoría"
        title="Encontrá rápido lo que necesitás"
        description="Accesos visuales a las verticales principales de tecnología, hogar y entretenimiento."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {categories.map(({ id, title, description, href, image, icon: Icon, accent }) => (
          <Link
            key={id}
            href={href}
            className={`cc-focus-ring group relative min-h-[154px] overflow-hidden rounded-[22px] border border-cc-border bg-gradient-to-br ${accentClass[accent]} p-4 shadow-cc-xs transition-[transform,border-color,box-shadow] duration-[220ms] ease-cc-out hover:-translate-y-[3px] hover:border-cc-primary-border hover:shadow-cc-md`}
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/85 text-cc-primary shadow-cc-xs">
              <Icon className="h-4.5 w-4.5" strokeWidth={2} />
            </span>
            <h3 className="mt-4 max-w-[128px] text-[16px] font-black tracking-[-0.02em] text-cc-text">{title}</h3>
            <p className="mt-1 max-w-[128px] text-[12px] leading-5 text-cc-secondary">{description}</p>
            <span className="mt-3 inline-flex items-center text-[12px] font-extrabold text-cc-primary">
              Ver productos
              <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform duration-[180ms] group-hover:translate-x-0.5" />
            </span>
            {image ? (
              <Image
                src={image.src}
                alt={image.alt}
                width={image.width}
                height={image.height}
                sizes="(min-width: 1280px) 12vw, (min-width: 640px) 30vw, 42vw"
                className="absolute -bottom-4 -right-5 max-h-[112px] w-auto max-w-[58%] object-contain drop-shadow-[0_16px_22px_rgba(16,24,40,.13)] transition-transform duration-[260ms] ease-cc-out group-hover:scale-[1.035]"
              />
            ) : (
              <span className="absolute -bottom-6 -right-6 grid h-24 w-24 place-items-center rounded-full bg-cc-primary/8 text-cc-primary/30 transition-transform duration-[260ms] ease-cc-out group-hover:scale-110">
                <Icon className="h-10 w-10" strokeWidth={1.4} />
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
