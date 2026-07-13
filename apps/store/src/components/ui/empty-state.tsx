"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Cloud } from "lucide-react";

export function EmptyState({ title, description, actionLabel, actionHref, children }: { title: string; description: string; actionLabel?: string; actionHref?: string; children?: ReactNode }) {
  return <motion.section initial={{ opacity: 0, transform: "translateY(8px)" }} animate={{ opacity: 1, transform: "translateY(0px)" }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col items-center justify-center rounded-cc-xl border border-cc-border-subtle bg-cc-shell px-5 py-14 text-center shadow-cc-sm"><span aria-hidden="true" className="relative grid h-20 w-20 place-items-center rounded-full bg-cc-primary-soft animate-cc-float"><span className="absolute inset-2 rounded-full border border-cc-primary-border" /><Cloud className="relative h-9 w-9 text-cc-primary" strokeWidth={1.5} /></span><h1 className="mt-5 text-[20px] font-bold text-cc-text">{title}</h1><p className="mt-2 max-w-[420px] text-[14px] leading-6 text-cc-muted">{description}</p>{children}{actionLabel && actionHref && <Link href={actionHref} className="cc-focus-ring mt-5 inline-flex min-h-11 items-center justify-center rounded-cc-sm bg-cc-primary px-5 text-[13px] font-bold text-cc-shell transition-[background-color,transform] duration-[var(--cc-duration-fast)] ease-cc-out hover:bg-cc-primary-hover active:scale-[0.98]">{actionLabel}</Link>}</motion.section>;
}
