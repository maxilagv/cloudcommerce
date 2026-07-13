"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Cloud, Quote } from "lucide-react";

const testimonials = [
  { quote: "Comprar y seguir cada pedido se siente claro desde el primer momento.", author: "Cliente CloudCommerce" },
  { quote: "Una tienda pensada para que encuentres lo que buscás sin vueltas.", author: "Comprador verificado" },
];

export function AuthShell({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [testimonial, setTestimonial] = useState(0);
  useEffect(() => { if (reduceMotion) return; const interval = window.setInterval(() => setTestimonial((current) => (current + 1) % testimonials.length), 6000); return () => window.clearInterval(interval); }, [reduceMotion]);
  return <main className="grid min-h-[100dvh] bg-cc-shell lg:grid-cols-2"><section className="relative hidden overflow-hidden p-10 text-cc-shell lg:flex lg:flex-col" style={{ backgroundImage: "linear-gradient(135deg, var(--cc-primary-hover), var(--cc-primary))" }}><span aria-hidden="true" className="absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-cc-shell/10 blur-3xl" /><span aria-hidden="true" className="absolute -bottom-28 right-0 h-96 w-96 rounded-full bg-cc-shell/10 blur-3xl" /><Link href="/" className="cc-focus-ring relative inline-flex w-fit items-center gap-2 rounded-cc-sm"><span className="grid h-10 w-10 place-items-center rounded-cc-sm bg-cc-shell text-cc-primary"><Cloud className="h-5 w-5" strokeWidth={1.75} /></span><span className="text-[20px] font-extrabold tracking-tight">CloudCommerce</span></Link><div className="relative my-auto max-w-[430px]"><p className="text-[36px] font-black leading-tight tracking-tight">Todo para elegir, comprar y recibir con confianza.</p><div className="relative mt-10 min-h-28"><motion.div key={testimonial} initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}><Quote className="h-5 w-5 text-cc-shell/75" strokeWidth={1.75} /><p className="mt-3 text-[16px] leading-7 text-cc-shell/90">{testimonials[testimonial].quote}</p><p className="mt-3 text-[13px] font-bold text-cc-shell/75">{testimonials[testimonial].author}</p></motion.div></div></div></section><section className="flex min-h-[100dvh] items-center justify-center bg-cc-shell px-5 py-10 sm:px-8"><div className="w-full max-w-[420px]"><Link href="/" className="cc-focus-ring mb-10 inline-flex items-center gap-2 rounded-cc-sm lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-cc-sm bg-cc-primary text-cc-shell"><Cloud className="h-5 w-5" strokeWidth={1.75} /></span><span className="text-[19px] font-extrabold tracking-tight text-cc-text">CloudCommerce</span></Link>{children}</div></section></main>;
}
