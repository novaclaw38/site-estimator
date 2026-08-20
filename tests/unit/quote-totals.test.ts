import { describe, expect, it } from "vitest";
import { calculateQuoteTotals } from "@/lib/quotes/calculate-totals";

describe("calculateQuoteTotals", () => {
  it("sums line items, applies markup, and adds labor cost", () => {
    const result = calculateQuoteTotals({
      lineItems: [
        { quantity: 1, unitPrice: 4299 },
        { quantity: 2, unitPrice: 12 },
      ],
      markupPercent: 15,
      laborHours: 4.5,
      hourlyRate: 450,
    });
    expect(result.totalMaterialCost).toBe(4323);
    expect(result.grandTotal).toBeCloseTo(4323 * 1.15 + 4.5 * 450, 2);
  });
});
