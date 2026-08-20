import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { jobs, lineItems, quotes } from "@/lib/db/schema";
import { calculateQuoteTotals } from "@/lib/quotes/calculate-totals";
import { protectedProcedure, publicProcedure, router } from "../init";

async function assertOwnsQuote(userId: string, quoteId: string) {
  const rows = await db
    .select()
    .from(quotes)
    .innerJoin(jobs, eq(quotes.jobId, jobs.id))
    .where(eq(quotes.id, quoteId));
  const row = rows[0];
  if (!row || row.jobs.userId !== userId) throw new Error("Quote not found");
  return row.quotes;
}

async function recalculateAndSave(quoteId: string) {
  const items = await db
    .select()
    .from(lineItems)
    .where(eq(lineItems.quoteId, quoteId));
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId));
  if (!quote) return;

  const { totalMaterialCost, grandTotal } = calculateQuoteTotals({
    lineItems: items.map((i) => ({
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
    })),
    markupPercent: Number(quote.markupPercent),
    laborHours: Number(quote.laborHours),
    hourlyRate: Number(quote.hourlyRate),
  });

  await db
    .update(quotes)
    .set({
      totalMaterialCost: String(totalMaterialCost),
      grandTotal: String(grandTotal),
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, quoteId));
}

export const quotesRouter = router({
  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const quote = await assertOwnsQuote(ctx.userId, input.id);
      const items = await db
        .select()
        .from(lineItems)
        .where(eq(lineItems.quoteId, input.id));
      return { quote, lineItems: items };
    }),

  byJobId: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db
        .select()
        .from(quotes)
        .where(eq(quotes.jobId, input.jobId));
      const quote = rows[0];
      if (!quote) throw new Error("Quote not found for job");
      return quote;
    }),

  updateLineItem: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        quantity: z.number().positive(),
        unitPrice: z.number().nonnegative(),
      }),
    )
    .mutation(async ({ input }) => {
      await db
        .update(lineItems)
        .set({
          quantity: String(input.quantity),
          unitPrice: String(input.unitPrice),
        })
        .where(eq(lineItems.id, input.id));

      const [item] = await db
        .select()
        .from(lineItems)
        .where(eq(lineItems.id, input.id));
      if (item) await recalculateAndSave(item.quoteId);
      return { success: true };
    }),

  updateTerms: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        markupPercent: z.number().nonnegative(),
        laborHours: z.number().nonnegative(),
        hourlyRate: z.number().nonnegative(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnsQuote(ctx.userId, input.id);
      await db
        .update(quotes)
        .set({
          markupPercent: String(input.markupPercent),
          laborHours: String(input.laborHours),
          hourlyRate: String(input.hourlyRate),
          updatedAt: new Date(),
        })
        .where(eq(quotes.id, input.id));
      await recalculateAndSave(input.id);
      return { success: true };
    }),

  share: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const rows = await db
        .select()
        .from(quotes)
        .where(eq(quotes.id, input.id));
      const quote = rows[0];
      if (!quote) throw new Error("Quote not found");

      const shareToken =
        quote.shareToken ?? crypto.randomUUID().replace(/-/g, "");
      await db
        .update(quotes)
        .set({ shareToken, updatedAt: new Date() })
        .where(eq(quotes.id, input.id));
      return { shareToken };
    }),

  byShareToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const rows = await db
        .select()
        .from(quotes)
        .where(eq(quotes.shareToken, input.token));
      const quote = rows[0];
      if (!quote) throw new Error("Quote not found");
      const items = await db
        .select()
        .from(lineItems)
        .where(eq(lineItems.quoteId, quote.id));
      return { quote, lineItems: items };
    }),
});
