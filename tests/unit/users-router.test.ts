import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/get-or-create-user", () => ({
  getOrCreateUser: vi.fn().mockResolvedValue({
    id: "user_123",
    defaultMarkupPercent: "15",
    defaultHourlyRate: null,
  }),
}));

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: vi.fn().mockResolvedValue({
    primaryEmailAddress: { emailAddress: "a@b.com" },
    firstName: "A",
  }),
  auth: vi.fn(),
}));

import { usersRouter } from "@/lib/trpc/routers/users";

describe("usersRouter.me", () => {
  it("returns the current user for an authenticated context", async () => {
    const caller = usersRouter.createCaller({ userId: "user_123" });
    const result = await caller.me();
    expect(result.id).toBe("user_123");
  });
});
