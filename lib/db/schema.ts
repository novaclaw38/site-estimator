import {
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "analyzing",
  "pricing",
  "ready",
  "failed",
]);
export const lineItemCategoryEnum = pgEnum("line_item_category", [
  "core",
  "consumable",
  "hardware",
]);
export const vendorEnum = pgEnum("vendor", [
  "builders",
  "cashbuild",
  "chamberlain",
  "brights",
  "gelmar",
]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email"),
  businessName: text("business_name"),
  defaultHourlyRate: numeric("default_hourly_rate"),
  defaultMarkupPercent: numeric("default_markup_percent")
    .notNull()
    .default("15"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  status: jobStatusEnum("status").notNull().default("queued"),
  mediaKeys: text("media_keys").array().notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const quotes = pgTable("quotes", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id")
    .notNull()
    .unique()
    .references(() => jobs.id),
  trade: text("trade").notNull(),
  jobTitle: text("job_title").notNull(),
  scopeOfWork: text("scope_of_work").notNull(),
  hazardsNotes: jsonb("hazards_notes").$type<string[]>().notNull().default([]),
  totalMaterialCost: numeric("total_material_cost").notNull().default("0"),
  markupPercent: numeric("markup_percent").notNull().default("15"),
  laborHours: numeric("labor_hours").notNull().default("0"),
  hourlyRate: numeric("hourly_rate").notNull().default("0"),
  grandTotal: numeric("grand_total").notNull().default("0"),
  currency: text("currency").notNull().default("ZAR"),
  shareToken: text("share_token").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const lineItems = pgTable("line_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  quoteId: uuid("quote_id")
    .notNull()
    .references(() => quotes.id),
  category: lineItemCategoryEnum("category").notNull(),
  itemName: text("item_name").notNull(),
  quantity: numeric("quantity").notNull(),
  unit: text("unit").notNull(),
  vendorName: text("vendor_name"),
  unitPrice: numeric("unit_price").notNull().default("0"),
  sourceNote: text("source_note"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const vendorPriceCache = pgTable(
  "vendor_price_cache",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    normalizedItemName: text("normalized_item_name").notNull(),
    vendor: vendorEnum("vendor").notNull(),
    price: numeric("price").notNull(),
    productUrl: text("product_url").notNull(),
    scrapedAt: timestamp("scraped_at").defaultNow().notNull(),
  },
  (table) => ({
    vendorItemIdx: uniqueIndex("vendor_item_idx").on(
      table.normalizedItemName,
      table.vendor,
    ),
  }),
);
