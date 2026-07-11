"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";

/** Catches errors thrown inside (shop) routes. AppShell (header/footer) stays
 *  mounted around this since the error boundary only replaces the page content. */
export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-[480px] flex-col items-center px-4 py-24 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-cc-danger-soft">
        <TriangleAlert className="h-8 w-8 text-cc-danger" strokeWidth={1.6} />
      </div>
      <h1 className="mt-5 text-[22px] font-bold text-cc-text">Algo salió mal</h1>
      <p className="mt-2 text-[14px] text-cc-secondary">
        Tuvimos un problema al cargar esta página. Podés intentar de nuevo o volver al inicio.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="cc-focus-ring flex h-11 items-center gap-2 rounded-full bg-cc-primary px-5 text-[14px] font-bold text-white transition-colors hover:bg-cc-primary-hover"
        >
          <RotateCw className="h-4 w-4" strokeWidth={2} />
          Reintentar
        </button>
        <Link
          href="/"
          className="cc-focus-ring flex h-11 items-center rounded-full border border-cc-border px-5 text-[14px] font-semibold text-cc-text transition-colors hover:border-cc-primary-border hover:text-cc-primary"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
