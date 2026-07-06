import { randomBytes } from "node:crypto";

/**
 * Reglas puras del programa CloudPoints. Sin IO: todo lo que decide puntos,
 * disponibilidad y códigos vive acá para poder testearse en aislamiento y
 * ejecutarse dentro de transacciones del repositorio sin sorpresas.
 */

/** Centavos que equivalen a $1.000 ARS (la unidad de acreditación). */
export const MINOR_PER_1000 = 100_000;

/**
 * Puntos ganados por una orden entregada: `floor(total / $1.000) * tasa`.
 * Redondeo SIEMPRE hacia abajo — el programa nunca regala fracciones.
 */
export const computeEarnedPoints = (totalMinor: number, pointsPer1000: number): number => {
  if (totalMinor <= 0 || pointsPer1000 <= 0) {
    return 0;
  }
  return Math.floor(totalMinor / MINOR_PER_1000) * pointsPer1000;
};

export type RewardAvailabilityState = {
  isActive: boolean;
  availableFrom: Date | null;
  availableUntil: Date | null;
  stock: number | null;
};

/** ¿La ventana de rotación del regalo está abierta en `now`? (ignora stock). */
export const isRewardWindowOpen = (
  reward: Pick<RewardAvailabilityState, "isActive" | "availableFrom" | "availableUntil">,
  now: Date,
): boolean => {
  if (!reward.isActive) {
    return false;
  }
  if (reward.availableFrom && reward.availableFrom > now) {
    return false;
  }
  if (reward.availableUntil && reward.availableUntil <= now) {
    return false;
  }
  return true;
};

/** ¿El regalo se puede canjear ahora? (ventana abierta + stock disponible). */
export const isRewardRedeemable = (reward: RewardAvailabilityState, now: Date): boolean =>
  isRewardWindowOpen(reward, now) && (reward.stock === null || reward.stock > 0);

/** Alfabeto sin caracteres ambiguos (0/O, 1/I/L) para códigos legibles. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Código de canje `CP-XXXX-XXXX`: 8 símbolos sobre un alfabeto de 31 →
 * ~8.5e11 combinaciones; la colisión la ataja el índice único de la DB.
 */
export const generateRedemptionCode = (): string => {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
    if (i === 3) {
      out += "-";
    }
  }
  return `CP-${out}`;
};

/** Claves de idempotencia canónicas del ledger. */
export const earnIdempotencyKey = (orderId: string): string => `earn:order:${orderId}`;
export const orderReversalIdempotencyKey = (orderId: string): string => `reversal:order:${orderId}`;
export const redemptionReversalIdempotencyKey = (redemptionId: string): string =>
  `reversal:redemption:${redemptionId}`;
