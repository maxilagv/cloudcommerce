"use client";

import { CreditCard, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export type PaymentData = {
  holder: string;
  number: string;
  expiry: string;
  cvc: string;
};

export const emptyPayment: PaymentData = { holder: "", number: "", expiry: "", cvc: "" };

export type PaymentErrors = Partial<Record<keyof PaymentData, string>>;

const digits = (s: string) => s.replace(/\D/g, "");

/** Group card digits in blocks of 4 for display. */
export function formatCardNumber(value: string): string {
  return digits(value).slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

export function formatExpiry(value: string): string {
  const d = digits(value).slice(0, 4);
  return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

export function validatePayment(value: PaymentData): PaymentErrors {
  const errors: PaymentErrors = {};
  if (!value.holder.trim()) errors.holder = "Ingresá el titular";
  if (digits(value.number).length < 15) errors.number = "Número de tarjeta inválido";
  if (!/^\d{2}\/\d{2}$/.test(value.expiry)) errors.expiry = "MM/AA";
  if (digits(value.cvc).length < 3) errors.cvc = "CVC inválido";
  return errors;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  error,
  className,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  className?: string;
  maxLength?: number;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[12px] font-semibold text-cc-secondary">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-11 rounded-cc-sm border bg-white px-3 text-[14px] text-cc-text outline-none transition-[border-color,box-shadow] duration-[140ms]",
          "placeholder:text-cc-faint focus:ring-2 focus:ring-cc-primary/10",
          error
            ? "border-cc-danger focus:border-cc-danger"
            : "border-cc-border focus:border-cc-primary",
        )}
      />
      {error && <span className="text-[11px] text-cc-danger">{error}</span>}
    </label>
  );
}

export function PaymentForm({
  value,
  onChange,
  errors = {},
}: {
  value: PaymentData;
  onChange: (next: PaymentData) => void;
  errors?: PaymentErrors;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-[12px] font-semibold text-cc-secondary">Titular de la tarjeta</span>
          <input
            type="text"
            value={value.holder}
            onChange={(e) => onChange({ ...value, holder: e.target.value })}
            placeholder="Como aparece en la tarjeta"
            className={cn(
              "h-11 rounded-cc-sm border bg-white px-3 text-[14px] text-cc-text outline-none transition-[border-color,box-shadow] duration-[140ms]",
              "placeholder:text-cc-faint focus:ring-2 focus:ring-cc-primary/10",
              errors.holder
                ? "border-cc-danger focus:border-cc-danger"
                : "border-cc-border focus:border-cc-primary",
            )}
          />
          {errors.holder && <span className="text-[11px] text-cc-danger">{errors.holder}</span>}
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-[12px] font-semibold text-cc-secondary">Número de tarjeta</span>
          <div className="relative">
            <CreditCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cc-muted" />
            <input
              type="text"
              inputMode="numeric"
              value={value.number}
              onChange={(e) => onChange({ ...value, number: formatCardNumber(e.target.value) })}
              placeholder="0000 0000 0000 0000"
              className={cn(
                "h-11 w-full rounded-cc-sm border bg-white pl-9 pr-3 text-[14px] tracking-wider text-cc-text outline-none transition-[border-color,box-shadow] duration-[140ms]",
                "placeholder:text-cc-faint focus:ring-2 focus:ring-cc-primary/10",
                errors.number
                  ? "border-cc-danger focus:border-cc-danger"
                  : "border-cc-border focus:border-cc-primary",
              )}
            />
          </div>
          {errors.number && <span className="text-[11px] text-cc-danger">{errors.number}</span>}
        </label>

        <Field
          label="Vencimiento"
          value={value.expiry}
          onChange={(v) => onChange({ ...value, expiry: formatExpiry(v) })}
          placeholder="MM/AA"
          error={errors.expiry}
          maxLength={5}
        />
        <Field
          label="CVC"
          value={value.cvc}
          onChange={(v) => onChange({ ...value, cvc: v.replace(/\D/g, "").slice(0, 4) })}
          placeholder="123"
          error={errors.cvc}
          maxLength={4}
        />
      </div>

      <p className="flex items-center gap-1.5 text-[12px] text-cc-muted">
        <Lock className="h-3.5 w-3.5" strokeWidth={2} />
        Pago simulado — no se realizará ningún cargo real.
      </p>
    </div>
  );
}
