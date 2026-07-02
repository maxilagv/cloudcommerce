/** Static config used across checkout, shipping and location UIs. */

export type ShippingOption = {
  id: string;
  label: string;
  detail: string;
  cost: number;
};

export const SHIPPING_OPTIONS: ShippingOption[] = [
  { id: "standard", label: "Envio estandar", detail: "Llega en 3 a 5 dias habiles", cost: 0 },
  { id: "express", label: "Envio express", detail: "Llega en 24 a 48 horas", cost: 24900 },
  { id: "pickup", label: "Retiro coordinado", detail: "Listo para coordinar en 2 horas", cost: 0 },
];

export const DEFAULT_SHIPPING_ID = "standard";

export const ARGENTINA_CITIES: string[] = [
  "Buenos Aires, AR",
  "Cordoba, AR",
  "Rosario, AR",
  "Mendoza, AR",
  "La Plata, AR",
  "Mar del Plata, AR",
  "San Miguel de Tucuman, AR",
  "Salta, AR",
  "Santa Fe, AR",
  "Neuquen, AR",
];

export const DEFAULT_CITY = "Buenos Aires, AR";
