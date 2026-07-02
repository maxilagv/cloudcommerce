import { PricingValueKind } from "@cloudcommerce/types";
import { describe, expect, it } from "vitest";
import { applyMarkup, marginBps, minSalePriceForMargin, multiplyByBasisPoints } from "../../domain/money.js";

describe("pricing money policy", () => {
  it("computes markup and margin with integer minor units", () => {
    expect(applyMarkup(1_200_000, PricingValueKind.PERCENT, 5_000)).toBe(1_800_000);
    expect(marginBps(1_800_000, 1_200_000)).toBe(3_333);
  });

  it("rounds basis point multiplication deterministically", () => {
    expect(multiplyByBasisPoints(333, 3_333)).toBe(111);
  });

  it("raises sale price to satisfy minimum margin", () => {
    expect(minSalePriceForMargin(1_200_000, 2_500)).toBe(1_600_000);
  });
});
