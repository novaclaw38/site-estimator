import type { VendorPriceResult, VendorScraper } from "./types";

export const brights: VendorScraper = {
  vendor: "brights",
  async search(_query: string): Promise<VendorPriceResult[]> {
    return [];
  },
};
