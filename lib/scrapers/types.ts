export type VendorName =
  | "builders"
  | "cashbuild"
  | "chamberlain"
  | "brights"
  | "gelmar";

export interface VendorPriceResult {
  vendor: VendorName;
  productName: string;
  price: number;
  productUrl: string;
}

export interface VendorScraper {
  vendor: VendorName;
  search(query: string): Promise<VendorPriceResult[]>;
}
