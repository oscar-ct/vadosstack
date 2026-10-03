import { describe, expect, it } from "vitest";

import { calculateJobPricing } from "@/lib/job-pricing";

describe("job pricing", () => {
  it("leaves totals unchanged when other fees are disabled", () => {
    expect(
      calculateJobPricing({
        jobType: "Residential",
        laborSubtotal: 9000,
        materialsSubtotal: 1000,
        otherFeesEnabled: false,
        otherFeesRate: 3.5,
        taxRate: 8.25,
      }),
    ).toEqual({ otherFees: 0, subtotal: 10000, tax: 82.5, total: 10082.5 });
  });

  it("applies the fee to labor and materials before tax", () => {
    expect(
      calculateJobPricing({
        jobType: "Residential",
        laborSubtotal: 9000,
        materialsSubtotal: 1000,
        otherFeesEnabled: true,
        otherFeesRate: 3.5,
        taxRate: 8.25,
      }),
    ).toEqual({ otherFees: 350, subtotal: 10000, tax: 82.5, total: 10432.5 });
  });

  it("keeps commercial tax behavior while applying the fee to the same pre-tax subtotal", () => {
    expect(
      calculateJobPricing({
        jobType: "Commercial",
        laborSubtotal: 9000,
        materialsSubtotal: 1000,
        otherFeesEnabled: true,
        otherFeesRate: 3.5,
        taxRate: 8.25,
      }),
    ).toEqual({ otherFees: 350, subtotal: 10000, tax: 825, total: 11175 });
  });
});
