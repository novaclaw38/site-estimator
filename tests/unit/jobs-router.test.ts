import { describe, expect, it, vi } from "vitest";

const insertReturningMock = vi.fn();
const selectWhereMock = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {
    insert: () => ({ values: () => ({ returning: insertReturningMock }) }),
    select: () => ({
      from: () => ({ where: () => ({ orderBy: selectWhereMock }) }),
    }),
  },
}));

import { jobsRouter } from "@/lib/trpc/routers/jobs";

describe("jobsRouter", () => {
  it("create inserts a job with status queued and the given media keys", async () => {
    insertReturningMock.mockResolvedValueOnce([
      { id: "job_1", status: "queued", mediaKeys: ["jobs/user_123/a.mp4"] },
    ]);
    const caller = jobsRouter.createCaller({ userId: "user_123" });
    const result = await caller.create({ mediaKeys: ["jobs/user_123/a.mp4"] });
    expect(result.id).toBe("job_1");
  });

  it("list returns jobs for the current user only", async () => {
    selectWhereMock.mockResolvedValueOnce([{ id: "job_1" }, { id: "job_2" }]);
    const caller = jobsRouter.createCaller({ userId: "user_123" });
    const result = await caller.list();
    expect(result).toHaveLength(2);
  });
});
