import { eq } from "drizzle-orm";
import { analyzeJob } from "@/lib/ai/analyze-job";
import { db } from "@/lib/db/client";
import { jobs, lineItems, quotes } from "@/lib/db/schema";
import { findLowestPrice } from "@/lib/scrapers/index";

const CATEGORY_MAP = {
  "Core Component": "core",
  Consumable: "consumable",
  Hardware: "hardware",
} as const;

function mediaKeyToUrl(key: string): string {
  return `${process.env["R2_PUBLIC_URL"]}/${key}`;
}

export async function processJob(jobId: string): Promise<void> {
  const rows = await db.select().from(jobs).where(eq(jobs.id, jobId));
  const job = rows[0];
  if (!job) throw new Error(`Job ${jobId} not found`);

  try {
    await db
      .update(jobs)
      .set({ status: "analyzing", updatedAt: new Date() })
      .where(eq(jobs.id, jobId));
    const analysis = await analyzeJob(job.mediaKeys.map(mediaKeyToUrl));

    await db
      .update(jobs)
      .set({ status: "pricing", updatedAt: new Date() })
      .where(eq(jobs.id, jobId));

    const pricedItems = await Promise.all(
      analysis.line_items.map(async (item) => {
        const priceResult = await findLowestPrice(item.item_name);
        return { item, priceResult };
      }),
    );

    const totalMaterialCost = pricedItems.reduce(
      (sum, { priceResult, item }) => {
        return sum + (priceResult ? priceResult.price * item.quantity : 0);
      },
      0,
    );

    const markupPercent = 15;
    const laborHours = 0;
    const hourlyRate = 0;
    const grandTotal =
      totalMaterialCost * (1 + markupPercent / 100) + laborHours * hourlyRate;

    const [quote] = await db
      .insert(quotes)
      .values({
        jobId: job.id,
        trade: analysis.site_summary.trade,
        jobTitle: analysis.site_summary.job_title,
        scopeOfWork: analysis.site_summary.scope_of_work,
        hazardsNotes: analysis.site_summary.detected_hazards_or_notes,
        totalMaterialCost: String(totalMaterialCost),
        markupPercent: String(markupPercent),
        laborHours: String(laborHours),
        hourlyRate: String(hourlyRate),
        grandTotal: String(grandTotal),
      })
      .returning();

    if (!quote) throw new Error("Failed to create quote");

    await db.insert(lineItems).values(
      pricedItems.map(({ item, priceResult }, index) => ({
        quoteId: quote.id,
        category: CATEGORY_MAP[item.category],
        itemName: item.item_name,
        quantity: String(item.quantity),
        unit: item.unit,
        vendorName: priceResult?.vendor ?? null,
        unitPrice: priceResult ? String(priceResult.price) : "0",
        sourceNote: priceResult?.productUrl ?? null,
        sortOrder: index,
      })),
    );

    await db
      .update(jobs)
      .set({ status: "ready", updatedAt: new Date() })
      .where(eq(jobs.id, jobId));
  } catch (error) {
    await db
      .update(jobs)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));
  }
}
