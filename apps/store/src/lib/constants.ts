/** Static config used across checkout, shipping and location UIs. */

export type ShippingOption = {
  id: string;
  label: string;
  detail: string;
  cost: number;
};

export const SHIPPING_OPTIONS: ShippingOption[] = [
  { id: "standard", label: "Envío estándar", detail: "Llega en 3 a 5 días hábiles", cost: 0 },
  { id: "express", label: "Envío express", detail: "Llega en 24 a 48 horas", cost: 24900 },
  { id: "pickup", label: "Retiro coordinado", detail: "Listo para coordinar en 2 horas", cost: 0 },
];

export const DEFAULT_SHIPPING_ID = "standard";

export const ARGENTINA_CITIES: string[] = [
  "Buenos Aires, AR",
  "Córdoba, AR",
  "Rosario, AR",
  "Mendoza, AR",
  "La Plata, AR",
  "Mar del Plata, AR",
  "San Miguel de Tucumán, AR",
  "Salta, AR",
  "Santa Fe, AR",
  "Neuquén, AR",
];

export const DEFAULT_CITY = "Buenos Aires, AR";
