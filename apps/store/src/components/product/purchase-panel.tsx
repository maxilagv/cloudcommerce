"use client";

import { useState } from "react";
import { Truck, ShieldCheck, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddToCartButton } from "./add-to-cart-button";

const PAYMENT_LOGOS = [
  { id: "visa", label: "VISA", color: "#1A1F71" },
  { id: "mc", label: "MC", color: "#EB001B" },
  { id: "amex", label: "AMEX", color: "#007BC1" },
  { id: "pse", label: "PSE", color: "#1B5E20" },
  { id: "nequi", label: "NEQUI", color: "#6B21A8" },
  { id: "banco", label: "BANCO", color: "#0D47A1" },
] as const;

export function PurchasePanel({ productName }: { productName: string }) {
  const [postal, setPostal] = useState("");

  return (
    <div className="rounded-cc-xl border border-cc-border bg-white shadow-cc-md overflow-hidden">
      {/* Delivery section */}
      <div className="p-5 flex flex-col gap-3.5">
        {/* Free shipping */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cc-success-soft">
            <Truck className="h-4 w-4 text-cc-success" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[13px] font-bold text-cc-text">
              Envío GRATIS a todo el país
            </p>
            <p className="text-[12px] text-cc-muted mt-0.5">
              Llega el{" "}
              <span className="font-semibold text-cc-text">
                lunes 30 jun
              </span>
            </p>
          </div>
        </div>

        {/* Postal calc */}
        <div className="flex gap-2 items-center">
          <MapPin className="h-4 w-4 text-cc-muted flex-shrink-0" strokeWidth={1.8} />
          <input
            type="text"
            placeholder="Código postal"
            value={postal}
            onChange={(e) => setPostal(e.target.value)}
            maxLength={6}
            className={cn(
              "flex-1 h-8 rounded-cc-xs border border-cc-border px-2.5 text-[12px]",
              "placeholder:text-cc-faint text-cc-text bg-white",
              "focus:outline-none focus:border-cc-primary focus:ring-2 focus:ring-cc-primary/10",
              "transition-[border-color,box-shadow] duration-[140ms]",
            )}
          />
          <button
            type="button"
            className={cn(
              "h-8 px-3 rounded-cc-xs border border-cc-border text-[12px] font-semibold text-cc-secondary",
              "hover:border-cc-primary hover:text-cc-primary transition-colors duration-[140ms]",
              "cc-focus-ring",
            )}
          >
            Calcular
          </button>
        </div>
      </div>

      <hr className="border-cc-border-subtle" />

      {/* Availability + trust */}
      <div className="px-5 py-3.5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cc-success flex-shrink-0" />
          <span className="text-[13px] text-cc-text font-medium">
            Disponible hoy
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck
            className="h-4 w-4 text-cc-primary flex-shrink-0"
            strokeWidth={1.8}
          />
          <span className="text-[13px] text-cc-secondary">
            Compra protegida CloudCommerce
          </span>
        </div>
      </div>

      <hr className="border-cc-border-subtle" />

      {/* Payment methods */}
      <div className="px-5 py-3.5">
        <p className="text-[11px] text-cc-muted font-medium mb-2.5 uppercase tracking-wide">
          Métodos de pago
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {PAYMENT_LOGOS.map((logo) => (
            <div
              key={logo.id}
              className="flex items-center justify-center h-7 rounded border border-cc-border bg-cc-soft"
            >
              <span
                className="text-[10px] font-bold tracking-tight"
                style={{ color: logo.color }}
              >
                {logo.label}
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-2.5 text-[12px] text-cc-primary font-medium hover:underline"
        >
          Ver opciones de financiación →
        </button>
      </div>

      <hr className="border-cc-border-subtle" />

      {/* CTA */}
      <div className="p-4">
        <AddToCartButton productName={productName} size="lg" />
      </div>
    </div>
  );
}
