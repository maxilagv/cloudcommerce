import { PricingValueKind } from "@cloudcommerce/types";

const BASIS_POINTS = 10_000n;
const HALF_BASIS_POINTS = 5_000n;

const toSafeNumber = (value: bigint): number => {
  const numberValue = Number(value);
  if (!Number.isSafeInteger(numberValue)) {
    throw new RangeError("Money calculation exceeded safe integer range");
  }
  return numberValue;
};

export const multiplyByBasisPoints = (amountMinor: number, basisPoints: number): number => {
  const amount = BigInt(amountMinor);
  const bps = BigInt(basisPoints);
  return toSafeNumber((amount * bps + HALF_BASIS_POINTS) / BASIS_POINTS);
};

export const ceilDiv = (numerator: bigint, denominator: bigint): bigint => {
  if (denominator <= 0n) {
    throw new RangeError("denominator must be positive");
  }
  return (numerator + denominator - 1n) / denominator;
};

export const minSalePriceForMargin = (costAmountMinor: number, minMarginBps: number): number => {
  if (minMarginBps <= 0) {
    return costAmountMinor;
  }
  if (minMarginBps >= 10_000) {
    throw new RangeError("min margin must be lower than 100%");
  }
  const numerator = BigInt(costAmountMinor) * BASIS_POINTS;
  const denominator = BASIS_POINTS - BigInt(minMarginBps);
  return toSafeNumber(ceilDiv(numerator, denominator));
};

export const marginBps = (saleAmountMinor: number, costAmountMinor: number): number => {
  if (saleAmountMinor <= 0) {
    return 0;
  }
  const margin = BigInt(saleAmountMinor - costAmountMinor);
  return toSafeNumber((margin * BASIS_POINTS) / BigInt(saleAmountMinor));
};

export const applyMarkup = (costAmountMinor: number, kind: PricingValueKind, value: number): number => {
  if (kind === PricingValueKind.FIXED) {
    return costAmountMinor + value;
  }
  return costAmountMinor + multiplyByBasisPoints(costAmountMinor, value);
};

export const applyMinimumMargin = (saleAmountMinor: number, costAmountMinor: number, minMarginBpsValue: number | null): number => {
  if (minMarginBpsValue === null || minMarginBpsValue <= 0) {
    return saleAmountMinor;
  }
  return Math.max(saleAmountMinor, minSalePriceForMargin(costAmountMinor, minMarginBpsValue));
};
