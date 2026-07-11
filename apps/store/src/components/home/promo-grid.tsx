"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, LockKeyhole, Radar, Truck } from "lucide-react";
import type { HomePromo } from "@/lib/home-data";
import { BLUR_DATA_URL } from "@/lib/utils";
import { fadeSlideUp } from "@/lib/motion";
import { RevealGroup } from "@/components/ui/reveal-group";
import { SectionHeading } from "./section-heading";

const toneClass = {
  blue: "bg-[radial-gradient(circle_at_76%_22%,rgba(255,255,255,.34),transparent_30%),linear-gradient(135deg,#0B6BFF,#004ECC)] text-white border-transparent",
  light: "bg-gradient-to-br from-white to-cc-primary-softer text-cc-text border-cc-border",
  glass: "bg-white text-cc-text border-cc-border",
  success: "bg-gradient-to-br from-white to-cc-success-soft text-cc-text border-cc-border",
};

const iconByPromo = {
  shipping: Truck,
  protected: LockKeyhole,
  deal: Radar,
  arrivals: Radar,
};

export function PromoGrid({ promos }: { promos: HomePromo[] }) {
  if (promos.length === 0) return null;
  return (
    <section aria-labelledby="home-offers-title" className="mt-8">
      <SectionHeading
        eyebrow="Selección premium"
        title="Ofertas, lanzamientos y compra protegida"
        description="Módulos comerciales claros, sin ruido, pensados para avanzar rápido hacia productos relevantes."
      />
      <RevealGroup className="grid gap-4 lg:grid-cols-4">
        {promos.map((promo, index) => {
          const Icon = iconByPromo[promo.id as keyof typeof iconByPromo] ?? Radar;
          const primary = index === 0;
          return (
            <motion.div key={promo.id} variants={fadeSlideUp} className={primary ? "lg:col-span-2" : undefined}>
              <Link
                href={promo.href}
                className={`cc-focus-ring group relative block h-full overflow-hidden rounded-[24px] border p-5 shadow-cc-xs transition-[transform,border-color,box-shadow] duration-[220ms] ease-cc-out hover:-translate-y-[3px] hover:shadow-cc-md ${toneClass[promo.tone]} ${primary ? "min-h-[210px]" : "min-h-[170px]"}`}
              >
                <div className="relative z-10 max-w-[72%]">
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] ${promo.tone === "blue" ? "bg-white/18 text-white" : "bg-cc-primary-soft text-cc-primary"}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {promo.eyebrow}
                  </span>
                  <h3 className={`mt-4 text-[24px] font-black leading-tight tracking-[-0.04em] ${promo.tone === "blue" ? "text-white" : "text-cc-text"}`}>
                    {promo.title}
                  </h3>
                  <p className={`mt-2 text-sm leading-6 ${promo.tone === "blue" ? "text-white/82" : "text-cc-secondary"}`}>
                    {promo.description}
                  </p>
                  <span className={`mt-5 inline-flex items-center text-sm font-extrabold ${promo.tone === "blue" ? "text-white" : "text-cc-primary"}`}>
                    {promo.cta}
                    <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-[180ms] group-hover:translate-x-0.5" />
                  </span>
                </div>

                {promo.image ? (
                  <Image
                    src={promo.image.src}
                    alt={promo.image.alt}
                    width={promo.image.width}
                    height={promo.image.height}
                    sizes="(min-width: 1024px) 20vw, 60vw"
                    placeholder="blur"
                    blurDataURL={BLUR_DATA_URL}
                    className="absolute -bottom-6 -right-5 max-h-[150px] w-auto max-w-[42%] object-contain drop-shadow-[0_20px_24px_rgba(16,24,40,.18)] transition-transform duration-[260ms] ease-cc-out group-hover:scale-[1.035]"
                  />
                ) : (
                  <span className="absolute right-5 top-5 grid h-14 w-14 place-items-center rounded-full bg-cc-primary-soft text-cc-primary">
                    <Icon className="h-7 w-7" strokeWidth={1.8} />
                  </span>
                )}
              </Link>
            </motion.div>
          );
        })}
      </RevealGroup>
    </section>
  );
}
