/** Static config used across checkout, shipping, financing and location UIs. */

export type ShippingOption = {
  id: string;
  label: string;
  detail: string;
  cost: number;
};

export const SHIPPING_OPTIONS: ShippingOption[] = [
  { id: "standard", label: "Envío estándar", detail: "Llega en 3 a 5 días hábiles", cost: 0 },
  { id: "express", label: "Envío express", detail: "Llega en 24 a 48 horas", cost: 24900 },
  { id: "pickup", label: "Retiro en tienda", detail: "Listo para recoger en 2 horas", cost: 0 },
];

export const DEFAULT_SHIPPING_ID = "standard";

export const COLOMBIA_CITIES: string[] = [
  "Bogotá, CO",
  "Medellín, CO",
  "Cali, CO",
  "Barranquilla, CO",
  "Cartagena, CO",
  "Bucaramanga, CO",
  "Pereira, CO",
  "Santa Marta, CO",
  "Manizales, CO",
  "Cúcuta, CO",
];

export const DEFAULT_CITY = "Bogotá, CO";

/** Installment counts offered in the financing modal. */
export const FINANCING_PLANS = [3, 6, 12, 18, 24];
