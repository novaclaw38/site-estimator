# Site Estimator — Design Spec

Date: 2026-08-20
Status: Approved for planning

## Purpose

A contractor-facing web app ("SiteEstimator") that lets trade contractors (plumbers, electricians, carpenters, builders) record or upload video/audio/photos of a job site, runs multimodal AI analysis to detect the job type and scope, generates an itemized bill of materials, sources current material prices from South African hardware retailers, and produces an editable, shareable client quote.

v1 scope: a contractor-facing app with accounts (Clerk), the full AI-analysis-to-quote pipeline, live vendor price scraping across 5 named retailers, and a public read-only client share link. No payments/invoicing, no multi-currency, no PDF export (deferred).

## Stack (per `skills.md` defaults)

- **Frontend**: Next.js (App Router) + TypeScript strict + Tailwind v4 (semantic-token-driven `@theme`) + Radix/shadcn (restyled at the source, not verbatim defaults) + TanStack Query + Zustand + Zod v4 + Lucide icons + a deliberately chosen self-hosted variable font pair (not default Inter)
- **Backend**: Next.js Route Handlers + tRPC v11 + Drizzle ORM + Postgres via Neon
- **Auth**: Clerk
- **Media storage**: Cloudflare R2 (presigned upload URLs)
- **AI**: Google Gemini free tier (multimodal: video/audio/image → structured JSON), swappable later
- **Deployment**: Vercel (app); Neon (DB) and R2 are already-managed/serverless, no separate backend service needed at this scale
- **Tooling**: Vitest + Playwright + Testing Library, Biome, pnpm

## Architecture & Data Flow

1. Contractor signs in via Clerk, lands on `/dashboard`.
2. Starts a new job at `/jobs/new`: records video/audio in-browser (MediaRecorder API) or uploads existing files (drag/drop). Files upload directly to R2 via presigned URLs (never proxied through the Next.js server).
3. On submit, a `jobs` row is created (`status: queued`) referencing the uploaded R2 object keys. A background task is triggered (see "Background jobs" below).
4. Background task pipeline:
   a. **Analyze**: send media references + the SiteEstimator-AI system prompt to Gemini, requesting structured JSON output matching the app's Zod schema. Validate the response; on schema-validation failure, retry once with a stricter prompt, then mark `jobs.status = failed` with the error visible to the contractor.
   b. **Price**: for each generated line item, run the 5 vendor scrapers in parallel (`Promise.allSettled`, partial failures tolerated), check `vendor_price_cache` first (24h TTL) before hitting a live site, pick the lowest-priced plausible match per item.
   c. **Persist**: write a `quotes` row and its `line_items` rows.
   d. Set `jobs.status = ready`.
5. `/jobs/[id]` polls job status (TanStack Query) and shows progress (`Analyzing footage...` → `Pricing materials...` → `Ready`), then redirects to `/quotes/[id]`.
6. Contractor edits line items, markup %, labor hours/rate on `/quotes/[id]` — edits write directly to `quotes`/`line_items` rows, no re-invocation of AI needed for manual edits.
7. Contractor clicks "Share with client" → generates a unique `shareToken`, exposing a public read-only page at `/quote/[shareToken]`.

### Background jobs

No Redis/queue infra for v1. Background work runs via a DB-polled job table (the `jobs` table itself acts as the queue: a lightweight cron-triggered or `after()`-invoked worker picks up `status = queued` rows). This keeps v1 to a single deployable Next.js app per skills.md's "don't split services until it hurts" guidance. If scraping/AI volume grows, extraction to a dedicated worker service (BullMQ + Redis on Railway/Fly.io) is the documented escape hatch — not built now.

## Data Model (Drizzle / Postgres)

```
users
  id            text PK (Clerk user id)
  name          text
  email         text
  businessName  text nullable
  defaultHourlyRate   numeric nullable
  defaultMarkupPercent numeric default 15
  createdAt     timestamp

jobs
  id            uuid PK
  userId        text FK -> users.id
  status        enum(queued, analyzing, pricing, ready, failed)
  mediaKeys     text[]        -- R2 object keys
  errorMessage  text nullable
  createdAt     timestamp
  updatedAt     timestamp

quotes
  id                uuid PK
  jobId             uuid FK -> jobs.id, unique (1:1)
  trade             text     -- Plumbing | Electrical | Carpentry | General Contracting
  jobTitle          text
  scopeOfWork       text
  hazardsNotes      jsonb    -- string[]
  totalMaterialCost numeric
  markupPercent     numeric
  laborHours        numeric
  hourlyRate        numeric
  grandTotal        numeric
  currency          text default 'ZAR'
  shareToken        text unique nullable
  createdAt         timestamp
  updatedAt         timestamp

line_items
  id            uuid PK
  quoteId       uuid FK -> quotes.id
  category      enum(core, consumable, hardware)
  itemName      text
  quantity      numeric
  unit          text     -- meters | units | packs | rolls | liters
  vendorName    text
  unitPrice     numeric
  sourceNote    text nullable
  sortOrder     integer

vendor_price_cache
  id                  uuid PK
  normalizedItemName  text
  vendor              enum(builders, cashbuild, chamberlain, brights, gelmar)
  price               numeric
  productUrl          text
  scrapedAt           timestamp
  -- unique index on (normalizedItemName, vendor)
```

`quotes`/`line_items` are the editable source of truth once generated — the raw AI JSON is not re-read after initial persistence.

## AI Integration

`lib/ai/analyze-job.ts`: server-side module. Sends media (inline or via Gemini File API for larger files) plus a system prompt adapted from the provided SiteEstimator-AI spec, with Gemini's structured-output/response-schema feature enforcing the shape. Response is parsed and validated against a Zod schema mirroring the `site_summary` / `line_items` / `quote_breakdown` structure from the spec. Currency is forced to `ZAR` for v1 regardless of what the model returns. Provider is isolated behind a small interface (`analyzeJob(media): Promise<AnalysisResult>`) so swapping Gemini for another provider later is a single-module change.

## Vendor Scraping

Five isolated modules under `lib/scrapers/`: `builders.ts`, `cashbuild.ts`, `chamberlain.ts`, `brights.ts`, `gelmar.ts`, each implementing:

```ts
interface VendorScraper {
  vendor: VendorName
  search(query: string): Promise<VendorPriceResult[]>
}
```

Implementation per site depends on whether its search/product pages are static HTML (fetch + Cheerio) or JS-rendered (headless browser via Playwright) — determined per-vendor during implementation, not assumed upfront. Matching uses simple string-similarity on product titles for v1 (no ML-based matching). Results are cached in `vendor_price_cache` keyed by `(normalizedItemName, vendor)` with a 24h TTL to avoid redundant scraping.

**Explicit risk flag**: these are unofficial scrapers against retailer websites with no public pricing API. They are inherently fragile to site redesigns/anti-bot measures and must respect `robots.txt` and use reasonable rate limiting. This is a known, accepted v1 risk — not something eliminated by design. Scraper failures degrade gracefully (an item with no successful vendor match shows "price unavailable" rather than failing the whole quote).

## Pages

| Route | Purpose | Auth |
|---|---|---|
| `/sign-in`, `/sign-up` | Clerk auth flows | public |
| `/dashboard` | Contractor's job/quote list, "New Job" CTA | required |
| `/jobs/new` | Record-in-browser or upload media, submit job | required |
| `/jobs/[id]` | Processing status/progress, redirects to quote when ready | required, owner-only |
| `/quotes/[id]` | Editable quote (line items, markup, labor, totals), "Share" action | required, owner-only |
| `/quote/[shareToken]` | Public read-only client-facing quote | public |

## Design Craft

Per `skills.md` §3: before building any UI, establish the design-token file (primitive → semantic → component, OKLCH-based, APCA-contrast-checked) and an explicit anti-slop prohibition list (no purple/blue gradient hero, no default Inter, no unmodified shadcn defaults, no centered-hero-three-cards). Self-host a deliberately chosen variable font pair. Line-item tables and pricing figures use tabular numerals and a deliberate mono face for numeric-heavy readability (dashboard/quote tables are the numeric-heavy surfaces here).

## Testing

- **Vitest**: quote total/markup calculation logic, Zod schema validation for AI output, scraper HTML-parsing logic (against saved fixture HTML, not live sites).
- **Playwright**: e2e flow — sign in → upload media → job reaches `ready` → edit a line item → generate share link → view public quote page unauthenticated.
- Scraper tests never hit live vendor sites in CI (fixture-based) to avoid flakiness and rate-limit risk during test runs.

## Explicitly Out of Scope (v1)

- PDF export of quotes
- Multi-currency support (ZAR only)
- Payments/invoicing
- ML-based fuzzy product matching for vendor scraping (simple string similarity only)
- Dedicated worker/queue service (documented escape hatch, not built now)
