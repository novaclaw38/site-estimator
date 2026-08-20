import { describe, expect, it, vi } from "vitest";
import type { VendorPriceResult } from "@/lib/scrapers/types";

const { selectMock, insertValuesMock, buildersSearch, cashbuildSearch } =
  vi.hoisted(() => ({
    selectMock: vi.fn(),
    insertValuesMock: vi.fn(),
    buildersSearch: vi.fn(),
    cashbuildSearch: vi.fn(),
  }));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({ from: () => ({ where: selectMock }) }),
    insert: () => ({
      values: (v: unknown) => {
        insertValuesMock(v);
        return { onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) };
      },
    }),
  },
}));

vi.mock("@/lib/scrapers/builders", () => ({
  builders: { vendor: "builders", search: buildersSearch },
}));
vi.mock("@/lib/scrapers/cashbuild", () => ({
  cashbuild: { vendor: "cashbuild", search: cashbuildSearch },
}));
vi.mock("@/lib/scrapers/chamberlain", () => ({
  chamberlain: { vendor: "chamberlain", search: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@/lib/scrapers/brights", () => ({
  brights: { vendor: "brights", search: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@/lib/scrapers/gelmar", () => ({
  gelmar: { vendor: "gelmar", search: vi.fn().mockResolvedValue([]) },
}));

import { findLowestPrice, normalizeItemName } from "@/lib/scrapers/index";

describe("normalizeItemName", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeItemName("  22mm  Copper Pipe ")).toBe("22mm copper pipe");
  });
});

describe("findLowestPrice", () => {
  it("picks the cheapest result across vendors when nothing is cached", async () => {
    selectMock.mockResolvedValueOnce([]);
    const buildersResult: VendorPriceResult = {
      vendor: "builders",
      productName: "Copper pipe",
      price: 300,
      productUrl: "https://builders.co.za/a",
    };
    const cashbuildResult: VendorPriceResult = {
      vendor: "cashbuild",
      productName: "Copper pipe",
      price: 250,
      productUrl: "https://cashbuild.co.za/b",
    };
    buildersSearch.mockResolvedValueOnce([buildersResult]);
    cashbuildSearch.mockResolvedValueOnce([cashbuildResult]);

    const result = await findLowestPrice("22mm copper pipe");
    expect(result?.vendor).toBe("cashbuild");
    expect(result?.price).toBe(250);
  });

  it("returns null when every scraper fails or finds nothing", async () => {
    selectMock.mockResolvedValueOnce([]);
    buildersSearch.mockRejectedValueOnce(new Error("network error"));
    cashbuildSearch.mockResolvedValueOnce([]);

    const result = await findLowestPrice("unobtainium bracket");
    expect(result).toBeNull();
  });
});
