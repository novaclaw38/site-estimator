import * as cheerio from "cheerio";
import { parsePrice } from "./parse-price";
import type { VendorPriceResult, VendorScraper } from "./types";

const BASE_URL = "https://www.brights.co.za";
const searchUrl = (query: string) =>
  `${BASE_URL}/search?q=${encodeURIComponent(query)}`;

export const brights: VendorScraper = {
  vendor: "brights",
  async search(query: string): Promise<VendorPriceResult[]> {
    const res = await fetch(searchUrl(query), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SiteEstimatorBot/1.0; +https://site-estimator.app/bot)",
      },
    });
    if (!res.ok) return [];

    const html = await res.text();
    const $ = cheerio.load(html);
    const results: VendorPriceResult[] = [];

    $(".product-card").each((_, el) => {
      const productName = $(el)
        .find(".product-card__title")
        .first()
        .text()
        .trim();
      const priceText = $(el)
        .find(".product-card__price")
        .first()
        .text()
        .trim();
      const href = $(el).find("a").first().attr("href");
      const price = parsePrice(priceText);
      if (productName && price !== null && href) {
        results.push({
          vendor: "brights",
          productName,
          price,
          productUrl: href.startsWith("http") ? href : `${BASE_URL}${href}`,
        });
      }
    });

    return results;
  },
};
