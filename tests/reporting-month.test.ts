import { describe, expect, it } from "vitest";

import { formatUtcMonthShort, getUtcMonthKey, startOfUtcMonth } from "@/lib/reporting-month";

describe("UTC reporting months", () => {
  it("keeps an invoice just after UTC midnight in the new month", () => {
    const issuedAt = new Date("2026-07-01T00:16:12.891Z");

    expect(getUtcMonthKey(issuedAt)).toBe("2026-07");
  });

  it("builds stable month starts and labels across year boundaries", () => {
    const reference = new Date("2026-01-20T18:00:00.000Z");
    const previousMonth = startOfUtcMonth(reference, -1);

    expect(previousMonth.toISOString()).toBe("2025-12-01T00:00:00.000Z");
    expect(formatUtcMonthShort(previousMonth)).toBe("Dec");
  });
});
