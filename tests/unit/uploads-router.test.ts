import { describe, expect, it, vi } from "vitest";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://signed.example.com/upload"),
}));
vi.mock("@/lib/r2/client", () => ({
  r2Client: {},
  R2_BUCKET_NAME: "test-bucket",
}));

import { uploadsRouter } from "@/lib/trpc/routers/uploads";

describe("uploadsRouter.presign", () => {
  it("returns an upload URL and a generated object key", async () => {
    const caller = uploadsRouter.createCaller({ userId: "user_123" });
    const result = await caller.presign({
      fileName: "clip.mp4",
      contentType: "video/mp4",
    });
    expect(result.uploadUrl).toBe("https://signed.example.com/upload");
    expect(result.objectKey).toMatch(/^jobs\/user_123\/.+-clip\.mp4$/);
  });
});
