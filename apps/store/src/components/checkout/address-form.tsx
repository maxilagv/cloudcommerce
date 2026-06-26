"use client";

import { cn } from "@/lib/utils";

export type AddressData = {
  name: string;
  street: string;
  city: string;
  postal: string;
  phone: string;
};

export const emptyAddress: AddressData = {
  name: "",
  street: "",
  city: "",
  postal: "",
  phone: "",
};

export type AddressErrors = Partial<Record<keyof AddressData, string>>;

export function validateAddress(value: AddressData): AddressErrors {
  const errors: AddressErrors = {};
  if (!value.name.trim()) errors.name = "Ingresá tu nombre completo";
  if (!value.street.trim()) errors.street = "Ingresá tu dirección";
  if (!value.city.trim()) errors.city = "Ingresá tu ciudad";
  if (!/^\d{4,8}$/.test(value.postal.trim())) errors.postal = "Código postal inválido";
  if (!/^[\d\s+()-]{7,}$/.test(value.phone.trim())) errors.phone = "Teléfono inválido";
  return errors;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  error,
  className,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  className?: string;
  inputMode?: "text" | "numeric" | "tel";
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[12px] font-semibold text-cc-secondary">{label}</span>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
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

export function AddressForm({
  value,
  onChange,
  errors = {},
}: {
  value: AddressData;
  onChange: (next: AddressData) => void;
  errors?: AddressErrors;
}) {
  const set = (key: keyof AddressData) => (v: string) => onChange({ ...value, [key]: v });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field
        label="Nombre completo"
        value={value.name}
        onChange={set("name")}
        placeholder="Ej: María Pérez"
        error={errors.name}
        className="sm:col-span-2"
      />
      <Field
        label="Dirección"
        value={value.street}
        onChange={set("street")}
        placeholder="Calle, número, apto"
        error={errors.street}
        className="sm:col-span-2"
      />
      <Field label="Ciudad" value={value.city} onChange={set("city")} placeholder="Ciudad" error={errors.city} />
      <Field
        label="Código postal"
        value={value.postal}
        onChange={set("postal")}
        placeholder="110111"
        error={errors.postal}
        inputMode="numeric"
      />
      <Field
        label="Teléfono"
        value={value.phone}
        onChange={set("phone")}
        placeholder="+57 300 000 0000"
        error={errors.phone}
        inputMode="tel"
        className="sm:col-span-2"
      />
    </div>
  );
}
