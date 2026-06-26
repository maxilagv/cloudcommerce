"use client";

import Image from "next/image";
import Link from "next/link";
import { Scale, X } from "lucide-react";
import { useHydrated } from "@/hooks/use-hydrated";
import { useCompare } from "@/store/compare";

export function CompareBar() {
  const hydrated = useHydrated();
  const items = useCompare((s) => s.items);
  const remove = useCompare((s) => s.remove);
  const clear = useCompare((s) => s.clear);

  if (!hydrated || items.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <div className="flex w-full max-w-[680px] items-center gap-3 rounded-cc-xl border border-cc-border bg-white/95 p-2.5 pl-4 shadow-cc-lg backdrop-blur">
        <div className="flex items-center gap-2 pr-1">
          <Scale className="h-5 w-5 text-cc-primary" strokeWidth={1.9} />
          <span className="hidden text-[13px] font-bold text-cc-text sm:inline">
            Comparar
          </span>
        </div>

        {/* Thumbnails */}
        <div className="flex flex-1 items-center gap-2 overflow-x-auto">
          {items.map((p) => (
            <div
              key={p.id}
              className="group relative flex h-12 w-12 shrink-0 items-center justify-center rounded-cc-sm border border-cc-border bg-cc-soft"
            >
              <Image
                src={p.image}
                alt={p.imageAlt}
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
              />
              <button
                type="button"
                onClick={() => remove(p.id)}
                aria-label={`Quitar ${p.name}`}
                className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-cc-text text-white shadow-sm transition-transform hover:scale-110"
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={clear}
          className="shrink-0 px-2 text-[12px] font-medium text-cc-muted hover:text-cc-danger"
        >
          Vaciar
        </button>
        <Link
          href="/compare"
          className="shrink-0 rounded-[10px] bg-[linear-gradient(180deg,#1374FF_0%,#005FEF_100%)] px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_18px_rgba(11,107,255,0.24)] transition-[transform,filter] duration-[140ms] hover:-translate-y-px hover:brightness-[1.03]"
        >
          Comparar ({items.length})
        </Link>
      </div>
    </div>
  );
}
