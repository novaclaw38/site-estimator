import { describe, expect, it, vi } from "vitest";

const updateSetMock = vi.fn();
const selectResults: unknown[][] = [];

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => selectResults.shift() ?? [] }),
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

describe("quotesRouter.share", () => {
  it("generates and persists a unique share token", async () => {
    selectResults.push([
      {
        id: "11111111-1111-4111-8111-111111111111",
        jobId: "job_1",
        shareToken: null,
      },
    ]);
    const caller = quotesRouter.createCaller({ userId: "user_1" });
    const result = await caller.share({
      id: "11111111-1111-4111-8111-111111111111",
    });
    expect(result.shareToken).toHaveLength(32);
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ shareToken: result.shareToken }),
    );
  });
});
