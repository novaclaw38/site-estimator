import type { VendorPriceResult, VendorScraper } from "./types";

export const cashbuild: VendorScraper = {
  vendor: "cashbuild",
  async search(_query: string): Promise<VendorPriceResult[]> {
    return [];
  },
};
