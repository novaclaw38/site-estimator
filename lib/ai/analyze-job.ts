import { GoogleGenerativeAI } from "@google/generative-ai";
import { type AnalysisResult, analysisResultSchema } from "./schema";

const SYSTEM_PROMPT = `You are SiteEstimator-AI, an expert quantity surveyor and contractor assistant.
Analyze the provided job-site video, audio, or images. Identify:
- The trade (Plumbing, Electrical, Carpentry, or General Contracting)
- The job title and detailed scope of work
- Any hazards or access notes
- Every material required, including implicit consumables (e.g. solder, flux, wall anchors, tape) not directly visible
Apply a standard 10% waste margin to quantities where appropriate.
Respond with ONLY valid JSON matching this exact shape, no markdown fences, no commentary:
{
  "site_summary": { "trade": "...", "job_title": "...", "scope_of_work": "...", "detected_hazards_or_notes": ["..."] },
  "line_items": [{ "item_id": "item_001", "category": "Core Component | Consumable | Hardware", "item_name": "...", "quantity": 0, "unit": "meters | units | packs | rolls | liters" }]
}`;

export async function analyzeJob(mediaUrls: string[]): Promise<AnalysisResult> {
  const genAI = new GoogleGenerativeAI(process.env["GEMINI_API_KEY"] ?? "");
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json" },
  });

  const parts = await Promise.all(mediaUrls.map(fetchAsInlinePart));

  const first = await model.generateContent(parts);
  const firstParsed = safeParseAnalysis(first.response.text());
  if (firstParsed) return firstParsed;

  const retry = await model.generateContent([
    ...parts,
    {
      text: "Your previous response was not valid JSON matching the required schema. Return ONLY valid JSON, no markdown fences, no commentary.",
    },
  ]);
  const retryText = retry.response.text();
  const retryParsed = safeParseAnalysis(retryText);
  if (retryParsed) return retryParsed;

  throw new Error(
    `AI analysis failed to produce valid output: ${retryText.slice(0, 500)}`,
  );
}

function safeParseAnalysis(text: string): AnalysisResult | null {
  try {
    const json = JSON.parse(text);
    const result = analysisResultSchema.safeParse(json);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

async function fetchAsInlinePart(url: string) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const mimeType =
    res.headers.get("content-type") ?? "application/octet-stream";
  return {
    inlineData: {
      data: Buffer.from(buffer).toString("base64"),
      mimeType,
    },
  };
}
