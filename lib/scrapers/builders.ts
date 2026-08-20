import type { VendorPriceResult, VendorScraper } from "./types";

export const builders: VendorScraper = {
  vendor: "builders",
  async search(_query: string): Promise<VendorPriceResult[]> {
    return [];
  },
};
