import { describe, expect, it, vi } from "vitest";

const updateSetMock = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: () => ({
      set: (v: unknown) => {
        updateSetMock(v);
        return { where: vi.fn().mockResolvedValue(undefined) };
      },
    }),
  },
}));

import { quotesRouter } from "@/lib/trpc/routers/quotes";

describe("quotesRouter.updateLineItem", () => {
  it("updates the quantity and unit price of a line item", async () => {
    const caller = quotesRouter.createCaller({ userId: "user_1" });
    await caller.updateLineItem({
      id: "11111111-1111-4111-8111-111111111111",
      quantity: 3,
      unitPrice: 100,
    });
    expect(updateSetMock).toHaveBeenCalledWith({
      quantity: "3",
      unitPrice: "100",
    });
  });
});
