"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowRight, BadgeCheck, PackageCheck, ShieldCheck, Sparkles } from "lucide-react";
import { homeHeroCopy, type HeroShowcaseImage } from "@/lib/home-data";
import { BLUR_DATA_URL } from "@/lib/utils";
import { useTilt3d } from "@/hooks/use-tilt-3d";

const chips = [
  { label: "Envíos rápidos 24-48h", icon: PackageCheck, className: "left-[2%] top-[15%]", delay: "0s" },
  { label: "Compra segura", icon: ShieldCheck, className: "right-[2%] top-[7%]", delay: "0.9s" },
  { label: "Garantía oficial", icon: BadgeCheck, className: "right-[8%] bottom-[12%]", delay: "1.7s" },
];

export function HomeHero({ showcase }: { showcase: HeroShowcaseImage[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  // Background layers drift at different rates as the hero scrolls past.
  // Raw scroll-linked MotionValues bypass MotionConfig, so gate them here.
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const blobY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, 40]);
  const ringY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, 70]);

  const { rotateX, rotateY, onMouseMove, onMouseLeave } = useTilt3d(4);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="home-hero-title"
      className="relative overflow-hidden rounded-[30px] border border-cc-border bg-[radial-gradient(circle_at_76%_20%,rgba(11,107,255,0.18),transparent_30%),linear-gradient(135deg,#ffffff_0%,var(--cc-primary-softer)_46%,var(--cc-primary-soft)_100%)] px-5 py-8 shadow-cc-lg sm:px-8 lg:px-16 lg:py-12"
    >
      <motion.div style={{ y: blobY }} className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-white/70 blur-3xl" />
      <motion.div style={{ y: ringY }} className="absolute right-20 top-8 h-28 w-28 rounded-full border border-white/70" />
      <div className="absolute right-[37%] top-10 h-3 w-3 rounded-full bg-cc-primary/25 animate-cc-float" />
      <div className="absolute right-[8%] top-[42%] h-2 w-2 rounded-full bg-cc-primary/35 animate-cc-float [animation-delay:650ms]" />

      <div className="relative grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="max-w-[560px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-cc-primary-border bg-white/80 px-3 py-1.5 text-[12px] font-extrabold uppercase tracking-[0.16em] text-cc-primary shadow-cc-xs">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.2} />
            {homeHeroCopy.eyebrow}
          </div>

          <h1
            id="home-hero-title"
            className="mt-5 max-w-[620px] text-[40px] font-black leading-[0.98] tracking-[-0.055em] text-cc-text sm:text-[54px] xl:text-[62px]"
          >
            {homeHeroCopy.title}
          </h1>

          <p className="mt-5 max-w-[510px] text-[16px] leading-7 text-cc-secondary sm:text-[18px]">
            {homeHeroCopy.description}
          </p>

          <div className="mt-7 grid gap-3 sm:flex">
            <Link
              href="/products?deals=1"
              className="cc-focus-ring group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full bg-cc-primary px-6 text-[15px] font-extrabold text-white shadow-[0_16px_34px_rgba(11,107,255,.25)] transition-[transform,box-shadow,background] duration-[180ms] ease-cc-out hover:-translate-y-px hover:bg-cc-primary-hover hover:shadow-[0_18px_42px_rgba(11,107,255,.32)] active:translate-y-0 active:scale-[.985]"
            >
              {/* One-shot diagonal shine, resets on mouse-leave */}
              <span className="pointer-events-none absolute inset-0 -translate-x-[150%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[150%]" />
              <span className="relative">{homeHeroCopy.primaryCta}</span>
              <ArrowRight className="relative ml-2 h-4 w-4 transition-transform duration-[180ms] group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#home-categories"
              className="cc-focus-ring inline-flex h-12 items-center justify-center rounded-full border border-cc-primary-border bg-white/85 px-6 text-[15px] font-extrabold text-cc-primary shadow-cc-xs transition-[transform,box-shadow] duration-[180ms] ease-cc-out hover:-translate-y-px hover:shadow-cc-sm active:translate-y-0"
            >
              {homeHeroCopy.secondaryCta}
            </Link>
          </div>

          <div className="mt-7 flex flex-wrap gap-2 text-[12px] font-bold text-cc-secondary">
            <span className="rounded-full bg-white/80 px-3 py-1.5 shadow-cc-xs">Productos originales</span>
            <span className="rounded-full bg-white/80 px-3 py-1.5 shadow-cc-xs">Marcas líderes</span>
            <span className="rounded-full bg-white/80 px-3 py-1.5 shadow-cc-xs">Soporte experto</span>
          </div>
        </div>

        <motion.div
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          style={{ perspective: 800 }}
          className="relative min-h-[280px] lg:min-h-[360px]"
        >
          <div className="absolute inset-x-[7%] bottom-2 h-24 rounded-[50%] bg-white/80 shadow-[0_35px_60px_rgba(16,24,40,.12)]" />
          <div className="absolute inset-[8%] rounded-full border border-cc-primary/15" />
          <div className="absolute inset-[17%] rounded-full border border-white/80" />

          {/* Tilts toward the cursor — leve, capped at ±4° via useTilt3d */}
          <motion.div
            style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
            className="group absolute inset-0"
          >
            {showcase.map((product) => (
              <Link
                key={product.id}
                href={product.href}
                tabIndex={-1}
                aria-hidden="true"
                className={`absolute ${product.className}`}
              >
                <Image
                  src={product.src}
                  alt={product.alt}
                  width={420}
                  height={420}
                  priority={product.priority}
                  sizes="(min-width: 1024px) 34vw, 90vw"
                  placeholder="blur"
                  blurDataURL={BLUR_DATA_URL}
                  className="w-full object-contain drop-shadow-[0_20px_28px_rgba(16,24,40,.14)] transition-transform duration-[260ms] ease-cc-out hover:scale-[1.03]"
                />
              </Link>
            ))}
          </motion.div>

          {chips.map(({ label, icon: Icon, className, delay }) => (
            <span
              key={label}
              style={{ animationDelay: delay }}
              className={`absolute hidden animate-cc-float items-center gap-2 rounded-full border border-white/80 bg-white/88 px-3 py-2 text-[12px] font-extrabold text-cc-text shadow-cc-md backdrop-blur sm:inline-flex ${className}`}
            >
              <Icon className="h-4 w-4 text-cc-primary" strokeWidth={2} />
              {label}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
