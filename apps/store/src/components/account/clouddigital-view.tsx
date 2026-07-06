"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Cloud,
  Copy,
  ExternalLink,
  Hourglass,
  Lock,
  Rocket,
  Sparkles,
} from "lucide-react";
import {
  CloudDigitalStatus,
  type CloudDigitalBenefitView,
  type CloudDigitalMembershipView,
} from "@cloudcommerce/types";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "@/store/toast";

export function CloudDigitalView() {
  const [membership, setMembership] = useState<CloudDigitalMembershipView | null>(null);
  const [benefits, setBenefits] = useState<CloudDigitalBenefitView[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const refresh = useCallback(async () => {
    const [membershipResult, benefitsResult] = await Promise.allSettled([
      trpc.loyalty.cloudDigital.membership.query(),
      trpc.loyalty.cloudDigital.benefits.query(),
    ]);
    if (membershipResult.status === "fulfilled") setMembership(membershipResult.value);
    if (benefitsResult.status === "fulfilled") setBenefits(benefitsResult.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function join() {
    setJoining(true);
    try {
      const result = await trpc.loyalty.cloudDigital.join.mutate();
      setMembership(result);
      toast.success("¡Estás en la lista de espera!", {
        description: "Te vamos a avisar cuando tu acceso esté activo.",
      });
    } catch (error) {
      toast.error("No pudimos sumarte", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setJoining(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Código copiado");
    } catch {
      toast.error("No se pudo copiar el código");
    }
  }

  const isActive = membership?.status === CloudDigitalStatus.ACTIVE;

  if (loading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando CloudDigital">
        <div className="cc-skeleton h-[200px] rounded-cc-xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="cc-skeleton h-[150px] rounded-cc-xl" />
          <div className="cc-skeleton h-[150px] rounded-cc-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <section
        aria-labelledby="clouddigital-title"
        className="relative overflow-hidden rounded-cc-xl border border-cc-border bg-[radial-gradient(circle_at_20%_15%,rgba(30,134,255,.35),transparent_45%),linear-gradient(135deg,#0B1220,#152A4E)] p-6 text-white shadow-cc-md sm:p-8"
      >
        <div className="pointer-events-none absolute -right-16 -bottom-20 h-56 w-56 rounded-full bg-cc-primary/25 blur-3xl" />
        <div className="relative max-w-[560px]">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/90">
            <Cloud className="h-3.5 w-3.5" /> CloudDigital × LayerCloud
          </p>
          <h1 id="clouddigital-title" className="mt-4 text-[28px] font-black leading-tight tracking-[-0.03em] sm:text-[34px]">
            Descuentos en servicios digitales para tu propio e-commerce
          </h1>
          <p className="mt-3 text-[14px] leading-6 text-white/80">
            CloudDigital te da acceso a beneficios exclusivos en LayerCloud: hosting, dominios y
            herramientas para montar tu tienda online. Próximamente, exclusivo para emprendedores
            que están construyendo su propio e-commerce.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {!membership && (
              <button
                type="button"
                onClick={() => void join()}
                disabled={joining}
                className="cc-focus-ring inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-extrabold text-[#0B1220] transition-[transform,box-shadow] duration-[160ms] ease-cc-out hover:-translate-y-px hover:shadow-[0_14px_30px_rgba(0,0,0,.3)] active:translate-y-0 active:scale-[0.98] disabled:opacity-60"
              >
                <Rocket className="h-4 w-4" strokeWidth={2.2} />
                {joining ? "Sumándote…" : "Unirme a la lista de espera"}
              </button>
            )}
            {membership?.status === CloudDigitalStatus.WAITLIST && (
              <span
                role="status"
                className="inline-flex items-center gap-2 rounded-full bg-cc-warning/20 px-4 py-2 text-[13px] font-bold text-[#FFD08A]"
              >
                <Hourglass className="h-4 w-4" /> Estás en la lista de espera
              </span>
            )}
            {isActive && (
              <span
                role="status"
                className="inline-flex items-center gap-2 rounded-full bg-cc-success/20 px-4 py-2 text-[13px] font-bold text-[#8CE8B0]"
              >
                <BadgeCheck className="h-4 w-4" /> Membresía activa
              </span>
            )}
            {membership?.status === CloudDigitalStatus.REVOKED && (
              <span
                role="status"
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[13px] font-bold text-white/75"
              >
                Tu membresía fue dada de baja — escribinos si creés que es un error.
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section aria-labelledby="clouddigital-benefits-title">
        <h2 id="clouddigital-benefits-title" className="text-[18px] font-bold text-cc-text">
          Beneficios del programa
        </h2>
        <p className="mt-0.5 text-[13px] text-cc-muted">
          {isActive
            ? "Usá tus códigos exclusivos en LayerCloud."
            : "Los códigos se desbloquean cuando tu membresía se activa."}
        </p>

        {benefits.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-cc-xl border border-dashed border-cc-border bg-cc-surface py-14 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-cc-soft">
              <Sparkles className="h-6 w-6 text-cc-muted" strokeWidth={1.6} />
            </span>
            <p className="text-[14px] font-semibold text-cc-text">
              Estamos preparando los primeros beneficios
            </p>
            <p className="max-w-[340px] text-[13px] text-cc-muted">
              Sumate a la lista de espera para enterarte primero cuando estén disponibles.
            </p>
          </div>
        ) : (
          <ul className="cc-stagger mt-4 grid gap-4 sm:grid-cols-2" role="list">
            {benefits.map((benefit) => (
              <li
                key={benefit.id}
                className="flex flex-col rounded-cc-xl border border-cc-border bg-cc-surface p-4 shadow-cc-xs transition-[transform,border-color,box-shadow] duration-[220ms] ease-cc-out hover:-translate-y-[3px] hover:border-cc-primary-border hover:shadow-cc-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-cc-primary-soft px-2.5 py-1 text-[11px] font-bold text-cc-primary">
                    <Cloud className="h-3 w-3" /> {benefit.partner}
                  </span>
                  <span className="text-[18px] font-black tracking-tight text-cc-success">
                    {benefit.discountLabel}
                  </span>
                </div>
                <h3 className="mt-3 text-[15px] font-bold text-cc-text">{benefit.title}</h3>
                {benefit.description && (
                  <p className="mt-1 text-[13px] leading-5 text-cc-secondary">
                    {benefit.description}
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                  {benefit.code ? (
                    <button
                      type="button"
                      onClick={() => void copyCode(benefit.code!)}
                      aria-label={`Copiar código ${benefit.code}`}
                      className="cc-focus-ring inline-flex items-center gap-1.5 rounded-cc-sm bg-cc-soft px-2.5 py-1.5 font-mono text-[13px] font-bold tracking-wide text-cc-text transition-colors hover:bg-cc-primary-soft hover:text-cc-primary"
                    >
                      {benefit.code}
                      <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-cc-sm bg-cc-soft px-2.5 py-1.5 text-[12px] font-semibold text-cc-muted">
                      <Lock className="h-3.5 w-3.5" strokeWidth={2} />
                      Código al activarse
                    </span>
                  )}
                  {benefit.url && (
                    <a
                      href={benefit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cc-focus-ring inline-flex items-center gap-1 text-[13px] font-bold text-cc-primary hover:underline"
                    >
                      Ir a {benefit.partner}
                      <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
