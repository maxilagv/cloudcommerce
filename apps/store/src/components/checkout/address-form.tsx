"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type AddressData = { name: string; street: string; city: string; province: string; postal: string; phone: string };
export const emptyAddress: AddressData = { name: "", street: "", city: "", province: "", postal: "", phone: "" };
export type AddressErrors = Partial<Record<keyof AddressData, string>>;
export function validateAddress(value: AddressData): AddressErrors {
  const errors: AddressErrors = {};
  if (!value.name.trim()) errors.name = "Ingresá tu nombre completo";
  if (!value.street.trim()) errors.street = "Ingresá tu dirección";
  if (!value.city.trim()) errors.city = "Ingresá tu ciudad";
  if (!value.province.trim()) errors.province = "Ingresá tu provincia";
  if (!/^\d{4,8}$/.test(value.postal.trim())) errors.postal = "Código postal inválido";
  if (!/^[\d\s+()-]{7,}$/.test(value.phone.trim())) errors.phone = "Teléfono inválido";
  return errors;
}

function Field({ label, value, onChange, placeholder, error, className, inputMode, shouldShake }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; error?: string; className?: string; inputMode?: "text" | "numeric" | "tel"; shouldShake?: boolean }) {
  const reduceMotion = useReducedMotion();
  return <motion.label animate={error && shouldShake && !reduceMotion ? { transform: ["translateX(0px)", "translateX(-4px)", "translateX(4px)", "translateX(0px)"] } : { transform: "translateX(0px)" }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className={cn("flex flex-col gap-1.5", className)}>
    <span className="text-[12px] font-semibold text-cc-secondary">{label}</span>
    <input type="text" inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-invalid={Boolean(error)} aria-describedby={error ? `${label}-error` : undefined} className={cn("cc-focus-ring h-12 rounded-cc-sm border bg-cc-shell px-3 text-[14px] text-cc-text outline-none transition-[border-color,box-shadow] duration-[var(--cc-duration-fast)] ease-cc-out placeholder:text-cc-faint", error ? "border-cc-danger focus:border-cc-danger" : "border-cc-border focus:border-cc-primary")} />
    <AnimatePresence initial={false}>{error && <motion.span id={`${label}-error`} role="alert" initial={{ opacity: 0, transform: "translateY(-4px)" }} animate={{ opacity: 1, transform: "translateY(0px)" }} exit={{ opacity: 0, transform: "translateY(-4px)" }} transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }} className="text-[11px] font-medium text-cc-danger">{error}</motion.span>}</AnimatePresence>
  </motion.label>;
}

export function AddressForm({ value, onChange, errors = {}, shouldShake = false }: { value: AddressData; onChange: (next: AddressData) => void; errors?: AddressErrors; shouldShake?: boolean }) {
  const set = (key: keyof AddressData) => (next: string) => onChange({ ...value, [key]: next });
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Nombre completo" value={value.name} onChange={set("name")} placeholder="Ej: María Pérez" error={errors.name} shouldShake={shouldShake} className="sm:col-span-2" /><Field label="Dirección" value={value.street} onChange={set("street")} placeholder="Calle, número, apto" error={errors.street} shouldShake={shouldShake} className="sm:col-span-2" /><Field label="Ciudad" value={value.city} onChange={set("city")} placeholder="Ciudad" error={errors.city} shouldShake={shouldShake} /><Field label="Provincia" value={value.province} onChange={set("province")} placeholder="Ej: Buenos Aires" error={errors.province} shouldShake={shouldShake} /><Field label="Código postal" value={value.postal} onChange={set("postal")} placeholder="1043" error={errors.postal} inputMode="numeric" shouldShake={shouldShake} /><Field label="Teléfono" value={value.phone} onChange={set("phone")} placeholder="+54 11 0000 0000" error={errors.phone} inputMode="tel" shouldShake={shouldShake} /></div>;
}
