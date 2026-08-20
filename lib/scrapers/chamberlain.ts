import type { VendorPriceResult, VendorScraper } from "./types";

export const chamberlain: VendorScraper = {
  vendor: "chamberlain",
  async search(_query: string): Promise<VendorPriceResult[]> {
    return [];
  },
};
