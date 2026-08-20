import { describe, expect, it } from "vitest";
import {
  jobs,
  lineItems,
  quotes,
  users,
  vendorPriceCache,
} from "@/lib/db/schema";

describe("db schema", () => {
  it("exports all five tables", () => {
    expect(users).toBeDefined();
    expect(jobs).toBeDefined();
    expect(quotes).toBeDefined();
    expect(lineItems).toBeDefined();
    expect(vendorPriceCache).toBeDefined();
  });
});
