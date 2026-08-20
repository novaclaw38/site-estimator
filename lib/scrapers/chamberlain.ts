import * as cheerio from "cheerio";
import { parsePrice } from "./parse-price";
import type { VendorPriceResult, VendorScraper } from "./types";

const BASE_URL = "https://www.chamberlains.co.za";
const searchUrl = (query: string) =>
  `${BASE_URL}/catalogsearch/result/?q=${encodeURIComponent(query)}`;

export const chamberlain: VendorScraper = {
  vendor: "chamberlain",
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

    $(".product-item-info").each((_, el) => {
      const productName = $(el)
        .find(".product-item-link")
        .first()
        .text()
        .trim();
      const priceText = $(el).find(".price").first().text().trim();
      const href = $(el).find(".product-item-link").first().attr("href");
      const price = parsePrice(priceText);
      if (productName && price !== null && href) {
        results.push({
          vendor: "chamberlain",
          productName,
          price,
          productUrl: href.startsWith("http") ? href : `${BASE_URL}${href}`,
        });
      }
    });

    return results;
  },
};
