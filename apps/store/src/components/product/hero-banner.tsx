import Image from "next/image";
import { ArrowRight, Truck } from "lucide-react";

/**
 * Hero promocional — gradiente azul on-system (cc-primary-active -> bright blue).
 * Composición de productos flotantes con cc-float-soft (CSS puro).
 */
export function HeroBanner() {
  return (
    <section className="relative overflow-hidden rounded-cc-xl bg-[linear-gradient(110deg,#004ECC_0%,#0B6BFF_55%,#1E86FF_100%)] px-7 py-8 text-white sm:px-10">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-[#1E86FF]/40 blur-3xl"
      />

      <div className="relative flex items-center justify-between gap-6">
        {/* Copy */}
        <div className="max-w-md">
          <h1 className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.035em] sm:text-[34px]">
            Tecnología que
            <br />
            eleva tu vida.
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/85">
            Descubrí lo último en electrónica y electrodomésticos al mejor
            precio, con envío gratis y pago seguro.
          </p>
          <a
            href="#catalogo"
            className="cc-focus-ring mt-5 inline-flex items-center gap-2 rounded-[12px] bg-white px-5 py-2.5 text-sm font-semibold text-cc-primary shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition-[transform,box-shadow] duration-[160ms] ease-cc-out hover:-translate-y-px hover:shadow-[0_16px_34px_rgba(0,0,0,0.22)] active:translate-y-0 active:scale-[0.985]"
          >
            Ver catálogo completo
            <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
          </a>
        </div>

        {/* Floating product composition (decorative) */}
        <div className="relative hidden h-[180px] w-[300px] shrink-0 md:block">
          <div className="absolute right-6 top-2 animate-cc-float [animation-delay:-0.6s]">
            <Image
              src="/products/samsung-qled-55.svg"
              alt=""
              aria-hidden
              width={220}
              height={220}
              className="h-[140px] w-auto drop-shadow-[0_24px_30px_rgba(0,0,0,0.28)]"
            />
          </div>
          <div className="absolute -left-2 top-10 animate-cc-float">
            <Image
              src="/products/apple-macbook-air-m2.svg"
              alt=""
              aria-hidden
              width={180}
              height={180}
              className="h-[110px] w-auto drop-shadow-[0_24px_30px_rgba(0,0,0,0.28)]"
            />
          </div>
          <div className="absolute bottom-0 right-0 animate-cc-float [animation-delay:-1.4s]">
            <Image
              src="/products/jbl-charge5.svg"
              alt=""
              aria-hidden
              width={120}
              height={120}
              className="h-[88px] w-auto drop-shadow-[0_20px_26px_rgba(0,0,0,0.3)]"
            />
          </div>
        </div>
      </div>

      {/* Delivery badge + carousel dots */}
      <div className="relative mt-6 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur-md">
          <Truck className="h-4 w-4" strokeWidth={1.9} />
          Entrega en 24–48h en las principales ciudades
        </span>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-5 rounded-full bg-white" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/45" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/45" />
        </div>
      </div>
    </section>
  );
}
