import { describe, expect, it } from "vitest";

import {
  canTransitionPaymentStatus,
  decimalMoneyToMinorUnits,
  getNetPaymentMinorUnits,
  minorUnitsToDecimalMoney,
  normalizeCurrency,
} from "@/lib/payments/domain";

describe("payment money helpers", () => {
  it("converts decimal money without floating point rounding", () => {
    expect(decimalMoneyToMinorUnits("123.45")).toBe(12345);
    expect(decimalMoneyToMinorUnits("0.1")).toBe(10);
    expect(minorUnitsToDecimalMoney(12345)).toBe("123.45");
  });

  it("rejects fractional cents", () => {
    expect(() => decimalMoneyToMinorUnits("1.001")).toThrow();
  });

  it("only counts settled net funds toward the invoice balance", () => {
    expect(getNetPaymentMinorUnits({ amount: "100.00", refundedAmount: "25.00", status: "partially_refunded" })).toBe(
      7500,
    );
    expect(getNetPaymentMinorUnits({ amount: "100.00", status: "pending" })).toBe(0);
    expect(getNetPaymentMinorUnits({ amount: "100.00", refundedAmount: "100.00", status: "refunded" })).toBe(0);
  });

  it("normalizes ISO currency codes", () => {
    expect(normalizeCurrency(" usd ")).toBe("USD");
    expect(() => normalizeCurrency("dollars")).toThrow();
  });

  it("prevents stale provider events from moving a settled payment backward", () => {
    expect(canTransitionPaymentStatus("pending", "succeeded")).toBe(true);
    expect(canTransitionPaymentStatus("succeeded", "pending")).toBe(false);
    expect(canTransitionPaymentStatus("refunded", "succeeded")).toBe(false);
    expect(canTransitionPaymentStatus("disputed", "succeeded")).toBe(true);
  });
});
