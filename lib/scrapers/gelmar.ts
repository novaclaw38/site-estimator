import type { VendorPriceResult, VendorScraper } from "./types";

export const gelmar: VendorScraper = {
  vendor: "gelmar",
  async search(_query: string): Promise<VendorPriceResult[]> {
    return [];
  },
};
