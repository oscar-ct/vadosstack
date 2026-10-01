import { describe, expect, it } from "vitest";

import { calculateApplicationFeeMinorUnits, getApplicationFeeConfig } from "@/lib/payments/application-fee";

describe("application fee policy", () => {
  it("defaults to no application fee", () => {
    expect(getApplicationFeeConfig({})).toEqual({ basisPoints: 0, fixedMinorUnits: 0 });
    expect(calculateApplicationFeeMinorUnits(10_000, { basisPoints: 0, fixedMinorUnits: 0 })).toBe(0);
  });

  it("supports a percentage expressed in basis points", () => {
    expect(calculateApplicationFeeMinorUnits(10_000, { basisPoints: 250, fixedMinorUnits: 0 })).toBe(250);
  });

  it("supports a combined percentage and fixed fee", () => {
    expect(calculateApplicationFeeMinorUnits(10_000, { basisPoints: 100, fixedMinorUnits: 30 })).toBe(130);
  });

  it("rejects invalid configuration rather than silently charging a different fee", () => {
    expect(() => getApplicationFeeConfig({ PAYMENT_APPLICATION_FEE_BASIS_POINTS: "2.5" })).toThrow();
    expect(() => getApplicationFeeConfig({ PAYMENT_APPLICATION_FEE_BASIS_POINTS: "10001" })).toThrow();
  });

  it("rejects a fee that consumes the payment", () => {
    expect(() => calculateApplicationFeeMinorUnits(100, { basisPoints: 10_000, fixedMinorUnits: 0 })).toThrow();
    expect(() => calculateApplicationFeeMinorUnits(25, { basisPoints: 0, fixedMinorUnits: 30 })).toThrow();
  });
});
