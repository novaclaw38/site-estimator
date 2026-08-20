import { describe, expect, it, vi } from "vitest";

const updateSetMock = vi.fn();
const selectWhereMock = vi.fn();
const insertQuoteReturningMock = vi.fn();
const insertLineItemsMock = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({ from: () => ({ where: selectWhereMock }) }),
    update: () => ({
      set: (v: unknown) => {
        updateSetMock(v);
        return { where: vi.fn().mockResolvedValue(undefined) };
      },
    }),
    insert: (_table: unknown) => ({
      values: (v: unknown) => {
        if (Array.isArray(v)) {
          insertLineItemsMock(v);
          return { returning: vi.fn().mockResolvedValue([]) };
        }
        return { returning: insertQuoteReturningMock };
      },
    }),
  },
}));

vi.mock("@/lib/ai/analyze-job", () => ({
  analyzeJob: vi.fn().mockResolvedValue({
    site_summary: {
      trade: "Plumbing",
      job_title: "Geyser replacement",
      scope_of_work: "Replace burst geyser",
      detected_hazards_or_notes: ["Roof cavity access"],
    },
    line_items: [
      {
        item_id: "item_001",
        category: "Core Component",
        item_name: "150L geyser",
        quantity: 1,
        unit: "units",
      },
      {
        item_id: "item_002",
        category: "Consumable",
        item_name: "Teflon tape",
        quantity: 2,
        unit: "rolls",
      },
    ],
  }),
}));

vi.mock("@/lib/scrapers/index", () => ({
  findLowestPrice: vi
    .fn()
    .mockResolvedValueOnce({
      vendor: "builders",
      productName: "150L geyser",
      price: 4299,
      productUrl: "https://x/1",
    })
    .mockResolvedValueOnce(null),
}));

import { processJob } from "@/lib/jobs/process-job";

describe("processJob", () => {
  it("analyzes, prices, and persists a quote with line items, then marks the job ready", async () => {
    selectWhereMock.mockResolvedValueOnce([
      {
        id: "job_1",
        userId: "user_1",
        mediaKeys: ["jobs/user_1/a.mp4"],
        status: "queued",
      },
    ]);
    insertQuoteReturningMock.mockResolvedValueOnce([{ id: "quote_1" }]);

    await processJob("job_1");

    expect(insertLineItemsMock).toHaveBeenCalledWith([
      expect.objectContaining({
        itemName: "150L geyser",
        unitPrice: "4299",
        vendorName: "builders",
      }),
      expect.objectContaining({
        itemName: "Teflon tape",
        unitPrice: "0",
        vendorName: null,
      }),
    ]);
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ready" }),
    );
  });
});
