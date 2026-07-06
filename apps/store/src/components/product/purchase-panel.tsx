"use client";

import { useState } from "react";
import { LockKeyhole, MapPin, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductDetailData } from "@/lib/product-detail-types";
import { toast } from "@/store/toast";
import { AddToCartButton } from "./add-to-cart-button";

const PAYMENT_LOGOS = [
  { id: "visa", label: "VISA", color: "#1A1F71" },
  { id: "mc", label: "MC", color: "#EB001B" },
  { id: "amex", label: "AMEX", color: "#007BC1" },
  { id: "mp", label: "MP", color: "#009EE3" },
  { id: "modo", label: "MODO", color: "#111827" },
  { id: "cash", label: "EFECTIVO", color: "#166534" },
] as const;

const SECURITY_ITEMS = [
  { icon: ShieldCheck, label: "Compra protegida CloudCommerce" },
  { icon: PackageCheck, label: "Producto original con garantia oficial" },
  { icon: LockKeyhole, label: "Tus datos viajan protegidos" },
];

export function PurchasePanel({ product }: { product: ProductDetailData }) {
  const [postal, setPostal] = useState("");

  function calcShipping() {
    if (!/^\d{4,8}$/.test(postal.trim())) {
      toast.error("Ingresa un codigo postal valido");
      return;
    }
    toast.success(`Envio a ${postal}`, { description: "Llega en 2 a 4 dias habiles. Gratis" });
  }

  return (
    <div className="overflow-hidden rounded-cc-xl border border-cc-border bg-white shadow-cc-md">
      <div className="flex flex-col gap-3.5 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cc-success-soft">
            <Truck className="h-4 w-4 text-cc-success" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[13px] font-bold text-cc-text">Envio gratis a todo el pais</p>
            <p className="mt-0.5 text-[12px] text-cc-muted">
              Llega entre <span className="font-semibold text-cc-text">2 y 4 dias habiles</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 flex-shrink-0 text-cc-muted" strokeWidth={1.8} />
          <input
            type="text"
            placeholder="Codigo postal"
            value={postal}
            onChange={(e) => setPostal(e.target.value)}
            maxLength={8}
            className={cn(
              "h-8 flex-1 rounded-cc-xs border border-cc-border px-2.5 text-[12px]",
              "bg-white text-cc-text placeholder:text-cc-faint",
              "transition-[border-color,box-shadow] duration-[140ms]",
              "focus:border-cc-primary focus:outline-none focus:ring-2 focus:ring-cc-primary/10",
            )}
          />
          <button
            type="button"
            onClick={calcShipping}
            className={cn(
              "cc-focus-ring h-8 rounded-cc-xs border border-cc-border px-3 text-[12px] font-semibold text-cc-secondary",
              "transition-colors duration-[140ms] hover:border-cc-primary hover:text-cc-primary",
            )}
          >
            Calcular
          </button>
        </div>
      </div>

      <hr className="border-cc-border-subtle" />

      <div className="flex flex-col gap-3 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-cc-success" />
          <span className="text-[13px] font-medium text-cc-text">Disponible hoy</span>
        </div>
        {SECURITY_ITEMS.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon className="h-4 w-4 flex-shrink-0 text-cc-primary" strokeWidth={1.8} />
            <span className="text-[13px] text-cc-secondary">{label}</span>
          </div>
        ))}
      </div>

      <hr className="border-cc-border-subtle" />

      <div className="px-5 py-3.5">
        <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-cc-muted">
          Metodos de pago seguros
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {PAYMENT_LOGOS.map((logo) => (
            <div
              key={logo.id}
              className="flex h-7 items-center justify-center rounded border border-cc-border bg-cc-soft"
            >
              <span className="text-[10px] font-bold tracking-tight" style={{ color: logo.color }}>
                {logo.label}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2.5 text-[12px] font-medium text-cc-secondary">
          Pago cifrado, validacion segura y comprobante automatico.
        </p>
      </div>

      <hr className="border-cc-border-subtle" />

      <div className="p-4">
        <AddToCartButton product={product} size="lg" />
      </div>
    </div>
  );
}
