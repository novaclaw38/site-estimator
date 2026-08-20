import { describe, expect, it, vi } from "vitest";

const selectMock = vi.fn();
const insertMock = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({ from: () => ({ where: selectMock }) }),
    insert: () => ({ values: () => ({ returning: insertMock }) }),
  },
}));

import { getOrCreateUser } from "@/lib/auth/get-or-create-user";

describe("getOrCreateUser", () => {
  it("returns the existing user if found", async () => {
    selectMock.mockResolvedValueOnce([
      { id: "user_123", defaultMarkupPercent: "15", defaultHourlyRate: null },
    ]);
    const result = await getOrCreateUser("user_123", "a@b.com", "A");
    expect(result.id).toBe("user_123");
  });

  it("creates a new user if not found", async () => {
    selectMock.mockResolvedValueOnce([]);
    insertMock.mockResolvedValueOnce([
      { id: "user_456", defaultMarkupPercent: "15", defaultHourlyRate: null },
    ]);
    const result = await getOrCreateUser("user_456", "c@d.com", "C");
    expect(result.id).toBe("user_456");
  });
});
