import { describe, expect, it, vi } from "vitest";

const generateContentMock = vi.fn();

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({ generateContent: generateContentMock }),
  })),
}));

global.fetch = vi.fn().mockResolvedValue({
  arrayBuffer: async () => new ArrayBuffer(8),
  headers: new Headers({ "content-type": "video/mp4" }),
}) as unknown as typeof fetch;

import { analyzeJob } from "@/lib/ai/analyze-job";

const validResponse = {
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
  ],
};

describe("analyzeJob", () => {
  it("returns parsed, validated JSON on the first successful response", async () => {
    generateContentMock.mockResolvedValueOnce({
      response: { text: () => JSON.stringify(validResponse) },
    });
    const result = await analyzeJob(["https://r2.example.com/clip.mp4"]);
    expect(result.site_summary.trade).toBe("Plumbing");
    expect(result.line_items).toHaveLength(1);
  });

  it("retries once on invalid JSON, then succeeds", async () => {
    generateContentMock
      .mockResolvedValueOnce({ response: { text: () => "not json" } })
      .mockResolvedValueOnce({
        response: { text: () => JSON.stringify(validResponse) },
      });
    const result = await analyzeJob(["https://r2.example.com/clip.mp4"]);
    expect(result.site_summary.job_title).toBe("Geyser replacement");
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  it("throws after a second invalid response", async () => {
    generateContentMock
      .mockResolvedValueOnce({ response: { text: () => "not json" } })
      .mockResolvedValueOnce({ response: { text: () => "still not json" } });
    await expect(
      analyzeJob(["https://r2.example.com/clip.mp4"]),
    ).rejects.toThrow(/AI analysis failed/);
  });
});
