import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { vendorPriceCache } from "@/lib/db/schema";
import { brights } from "./brights";
import { builders } from "./builders";
import { cashbuild } from "./cashbuild";
import { chamberlain } from "./chamberlain";
import { gelmar } from "./gelmar";
import type { VendorPriceResult, VendorScraper } from "./types";

const SCRAPERS: VendorScraper[] = [
  builders,
  cashbuild,
  chamberlain,
  brights,
  gelmar,
];
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function normalizeItemName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function findLowestPrice(
  itemName: string,
): Promise<VendorPriceResult | null> {
  const normalized = normalizeItemName(itemName);
  const cutoff = new Date(Date.now() - CACHE_TTL_MS);

  const cachedRows = await db
    .select()
    .from(vendorPriceCache)
    .where(
      and(
        eq(vendorPriceCache.normalizedItemName, normalized),
        gt(vendorPriceCache.scrapedAt, cutoff),
      ),
    );

  const results: VendorPriceResult[] = cachedRows.map((row) => ({
    vendor: row.vendor,
    productName: itemName,
    price: Number(row.price),
    productUrl: row.productUrl,
  }));

  const cachedVendors = new Set(results.map((r) => r.vendor));
  const scrapersToRun = SCRAPERS.filter((s) => !cachedVendors.has(s.vendor));

  const outcomes = await Promise.allSettled(
    scrapersToRun.map((s) => s.search(itemName)),
  );

  for (let i = 0; i < scrapersToRun.length; i++) {
    const scraper = scrapersToRun[i];
    const outcome = outcomes[i];
    if (
      !scraper ||
      !outcome ||
      outcome.status !== "fulfilled" ||
      outcome.value.length === 0
    )
      continue;

    const best = outcome.value.reduce((a, b) => (a.price < b.price ? a : b));
    results.push(best);

    await db
      .insert(vendorPriceCache)
      .values({
        normalizedItemName: normalized,
        vendor: scraper.vendor,
        price: String(best.price),
        productUrl: best.productUrl,
      })
      .onConflictDoUpdate({
        target: [vendorPriceCache.normalizedItemName, vendorPriceCache.vendor],
        set: {
          price: String(best.price),
          productUrl: best.productUrl,
          scrapedAt: new Date(),
        },
      });
  }

  if (results.length === 0) return null;
  return results.reduce((a, b) => (a.price < b.price ? a : b));
}
