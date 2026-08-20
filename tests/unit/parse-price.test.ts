import { describe, expect, it } from "vitest";
import { parsePrice } from "@/lib/scrapers/parse-price";

describe("parsePrice", () => {
  it("parses a plain ZAR price", () => {
    expect(parsePrice("R 4,299.00")).toBe(4299);
  });

  it("parses a price with no thousands separator", () => {
    expect(parsePrice("R349.00")).toBe(349);
  });

  it("returns null for text with no number", () => {
    expect(parsePrice("Out of stock")).toBeNull();
  });
});
