import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { builders } from "@/lib/scrapers/builders";
import { cashbuild } from "@/lib/scrapers/cashbuild";

const buildersHtml = readFileSync(
  join(process.cwd(), "tests/fixtures/builders-search.html"),
  "utf-8",
);
const cashbuildHtml = readFileSync(
  join(process.cwd(), "tests/fixtures/cashbuild-search.html"),
  "utf-8",
);

describe("builders scraper", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => buildersHtml,
    }) as unknown as typeof fetch;
  });

  it("parses product name, price, and absolute URL from search results", async () => {
    const results = await builders.search("22mm copper pipe");
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      vendor: "builders",
      productName: "22mm Copper Pipe 3m",
      price: 285,
      productUrl: "https://www.builders.co.za/products/22mm-copper-pipe-3m",
    });
  });

  it("returns an empty array on a non-ok response", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    const results = await builders.search("anything");
    expect(results).toEqual([]);
  });
});

describe("cashbuild scraper", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => cashbuildHtml,
    }) as unknown as typeof fetch;
  });

  it("parses product name, price, and absolute URL from search results", async () => {
    const results = await cashbuild.search("drip tray");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      vendor: "cashbuild",
      productName: "Polyethylene Geyser Drip Tray 1200x600mm",
      price: 349,
      productUrl: "https://www.cashbuild.co.za/product/drip-tray-1200x600",
    });
  });
});
