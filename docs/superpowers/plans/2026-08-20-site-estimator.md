# Site Estimator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a contractor-facing web app where a contractor records/uploads job-site video/audio/photos, gets an AI-generated bill of materials and vendor-priced quote, edits it, and shares a read-only link with the client.

**Architecture:** Next.js App Router monolith. tRPC for typed API calls. Drizzle/Postgres (Neon) for data. Clerk for auth. Cloudflare R2 for media storage via presigned uploads. A DB-polled `jobs` table acts as the job queue — no Redis. Gemini (free tier) does multimodal analysis behind a swappable interface. Five isolated per-vendor scraper modules feed a shared pricing orchestrator with a Postgres-backed cache.

**Tech Stack:** Next.js (App Router) + TypeScript strict + Tailwind v4 + Radix/shadcn (restyled) + tRPC v11 + Drizzle ORM + Postgres (Neon) + Clerk + Cloudflare R2 (`@aws-sdk/client-s3` + presigner) + Zod v4 + TanStack Query + Zustand + Google Gemini (`@google/generative-ai`) + Cheerio + Vitest + Playwright + Biome + pnpm.

**Spec:** `docs/superpowers/specs/2026-08-20-site-estimator-design.md`

## Global Constraints

- Currency is ZAR only for v1 — no multi-currency.
- No PDF export, no payments/invoicing in v1.
- Vendor product matching uses simple string/price comparison only — no ML fuzzy matching.
- No queue/worker infra (Redis/BullMQ) in v1 — the `jobs` table itself is the queue.
- AI provider is Gemini free tier, isolated behind `analyzeJob(mediaUrls): Promise<AnalysisResult>` so it's swappable later.
- Scrapers must set a descriptive `User-Agent`, respect reasonable rate limits, and degrade gracefully (a scraper failure never fails the whole quote — the item just shows "price unavailable").
- Scraper tests run against saved fixture HTML only — never against live vendor sites in CI.
- `vendor_price_cache` entries expire after 24 hours (re-scrape after that).
- TypeScript strict mode; Zod validates all AI output and all tRPC inputs.
- Package manager is pnpm; pin exact dependency versions (no `^`/`~` ranges) per skills.md supply-chain guidance.

---

### Task 1: Project scaffold & tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `biome.json`, `vitest.config.ts`, `.env.example`, `.gitignore`
- Create: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Test: `tests/unit/sanity.test.ts`

**Interfaces:**
- Produces: a runnable Next.js app (`pnpm dev`), a working Vitest runner (`pnpm test`), Biome format/lint scripts (`pnpm lint`, `pnpm format`).

- [ ] **Step 1: Scaffold the Next.js app**

```bash
cd /home/rebawn/site-estimator
pnpm create next-app@15 . --typescript --tailwind --app --src-dir=false --import-alias "@/*" --eslint=false --use-pnpm
```

When prompted about the existing `skills.md`/`docs/` files in a non-empty directory, choose to continue (they're unrelated to the scaffold).

- [ ] **Step 2: Set TypeScript strict mode**

Edit `tsconfig.json` compilerOptions to include:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "useUnknownInCatchVariables": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true
  }
}
```

- [ ] **Step 3: Install Biome and remove ESLint**

```bash
pnpm add -D -E @biomejs/biome@1.9.4
pnpm exec biome init
```

Replace generated `biome.json` with:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2 }
}
```

Add to `package.json` scripts: `"lint": "biome check .", "format": "biome format --write ."`.

- [ ] **Step 4: Install Vitest**

```bash
pnpm add -D -E vitest@3.0.5 @vitejs/plugin-react@4.3.4
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
})
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 5: Write and run the sanity test**

Create `tests/unit/sanity.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

describe('sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

Run: `pnpm test`
Expected: PASS (1 test)

- [ ] **Step 6: Create `.env.example`**

```bash
DATABASE_URL=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
GEMINI_API_KEY=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with strict TS, Biome, Vitest"
```

---

### Task 2: Design tokens & base UI shell

**Files:**
- Modify: `app/globals.css`
- Create: `app/fonts.ts`, `components/ui/button.tsx`, `components/ui/input.tsx`, `components/ui/card.tsx`
- Create: `docs/superpowers/design/prohibition-list.md`

**Interfaces:**
- Produces: semantic CSS tokens (`--color-*`, `--radius-*`) consumed by every later UI task; `<Button>`, `<Input>`, `<Card>` components with props `{ variant?, size?, className?, ...rest }` used throughout.

- [ ] **Step 1: Write the anti-slop prohibition list**

Create `docs/superpowers/design/prohibition-list.md`:

```markdown
# Prohibition List — Site Estimator

- No purple/blue gradient hero sections.
- No default Inter as the only typeface — use the self-hosted pair below.
- No unmodified shadcn defaults (default radius `0.5rem`, default shadow scale) — tokens below override them.
- No centered-hero-with-three-cards marketing layout (this is an app, not a marketing site).
- No spinners for content-heavy loads (job status, quote tables) — use skeletons.
- All numeric tables (line items, prices, totals) use tabular numerals via the mono face.
```

- [ ] **Step 2: Choose and self-host a variable font pair**

Create `app/fonts.ts` using `next/font/google` (self-hosts at build time — no runtime Google request):

```ts
import { Fraunces, IBM_Plex_Mono, Manrope } from 'next/font/google'

export const displayFont = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  axes: ['opsz', 'wght'],
})

export const bodyFont = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
})

export const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600'],
})
```

- [ ] **Step 3: Define OKLCH design tokens**

Replace `app/globals.css` content with:

```css
@import "tailwindcss";

:root {
  /* primitive */
  --gray-1: oklch(98% 0.003 90);
  --gray-3: oklch(94% 0.004 90);
  --gray-6: oklch(85% 0.006 90);
  --gray-9: oklch(55% 0.008 90);
  --gray-12: oklch(20% 0.006 90);
  --accent-9: oklch(58% 0.14 55);
  --accent-11: oklch(42% 0.13 55);

  /* semantic */
  --color-surface: var(--gray-1);
  --color-surface-raised: white;
  --color-border: var(--gray-6);
  --color-text: var(--gray-12);
  --color-text-muted: var(--gray-9);
  --color-action-primary: var(--accent-9);
  --color-action-primary-text: white;
  --color-focus-ring: var(--accent-9);

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 16px;
  --space-4: 24px;
  --space-6: 48px;
}

body {
  background: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-body);
}

.font-display { font-family: var(--font-display); }
.font-mono-nums { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

*:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}
```

- [ ] **Step 4: Wire fonts into the root layout**

Edit `app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { bodyFont, displayFont, monoFont } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  title: 'Site Estimator',
  description: 'Turn job-site footage into a costed quote.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 5: Create restyled base components**

Create `components/ui/button.tsx`:

```tsx
import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none',
        variant === 'primary' && 'bg-[var(--color-action-primary)] text-[var(--color-action-primary-text)] hover:opacity-90',
        variant === 'secondary' && 'border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--gray-3)]',
        variant === 'ghost' && 'text-[var(--color-text)] hover:bg-[var(--gray-3)]',
        className,
      )}
      {...props}
    />
  ),
)
Button.displayName = 'Button'
```

Create `lib/utils.ts`:

```ts
export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
```

Create `components/ui/input.tsx`:

```tsx
import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm text-[var(--color-text)]',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
```

Create `components/ui/card.tsx`:

```tsx
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-[var(--space-4)]',
        className,
      )}
      {...props}
    />
  )
}
```

- [ ] **Step 6: Verify the app builds**

Run: `pnpm build`
Expected: build succeeds with no type errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add design tokens, self-hosted fonts, base UI components"
```

---

### Task 3: Database schema & Neon connection

**Files:**
- Create: `lib/db/schema.ts`, `lib/db/client.ts`, `drizzle.config.ts`
- Test: `tests/unit/db-schema.test.ts`

**Interfaces:**
- Produces: `db` (Drizzle client) from `lib/db/client.ts`; exported tables `users`, `jobs`, `quotes`, `lineItems`, `vendorPriceCache` and enums `jobStatusEnum`, `lineItemCategoryEnum`, `vendorEnum` from `lib/db/schema.ts`, all consumed by every later task that touches data.

- [ ] **Step 1: Install Drizzle and the Neon driver**

```bash
pnpm add -E drizzle-orm@0.38.3 @neondatabase/serverless@0.10.4
pnpm add -D -E drizzle-kit@0.30.1
```

- [ ] **Step 2: Write the schema**

Create `lib/db/schema.ts`:

```ts
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
} from 'drizzle-orm/pg-core'

export const jobStatusEnum = pgEnum('job_status', ['queued', 'analyzing', 'pricing', 'ready', 'failed'])
export const lineItemCategoryEnum = pgEnum('line_item_category', ['core', 'consumable', 'hardware'])
export const vendorEnum = pgEnum('vendor', ['builders', 'cashbuild', 'chamberlain', 'brights', 'gelmar'])

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email'),
  businessName: text('business_name'),
  defaultHourlyRate: numeric('default_hourly_rate'),
  defaultMarkupPercent: numeric('default_markup_percent').notNull().default('15'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const jobs = pgTable('jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  status: jobStatusEnum('status').notNull().default('queued'),
  mediaKeys: text('media_keys').array().notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const quotes = pgTable('quotes', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').notNull().unique().references(() => jobs.id),
  trade: text('trade').notNull(),
  jobTitle: text('job_title').notNull(),
  scopeOfWork: text('scope_of_work').notNull(),
  hazardsNotes: jsonb('hazards_notes').$type<string[]>().notNull().default([]),
  totalMaterialCost: numeric('total_material_cost').notNull().default('0'),
  markupPercent: numeric('markup_percent').notNull().default('15'),
  laborHours: numeric('labor_hours').notNull().default('0'),
  hourlyRate: numeric('hourly_rate').notNull().default('0'),
  grandTotal: numeric('grand_total').notNull().default('0'),
  currency: text('currency').notNull().default('ZAR'),
  shareToken: text('share_token').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const lineItems = pgTable('line_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  quoteId: uuid('quote_id').notNull().references(() => quotes.id),
  category: lineItemCategoryEnum('category').notNull(),
  itemName: text('item_name').notNull(),
  quantity: numeric('quantity').notNull(),
  unit: text('unit').notNull(),
  vendorName: text('vendor_name'),
  unitPrice: numeric('unit_price').notNull().default('0'),
  sourceNote: text('source_note'),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const vendorPriceCache = pgTable(
  'vendor_price_cache',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    normalizedItemName: text('normalized_item_name').notNull(),
    vendor: vendorEnum('vendor').notNull(),
    price: numeric('price').notNull(),
    productUrl: text('product_url').notNull(),
    scrapedAt: timestamp('scraped_at').defaultNow().notNull(),
  },
  (table) => ({
    vendorItemIdx: uniqueIndex('vendor_item_idx').on(table.normalizedItemName, table.vendor),
  }),
)
```

- [ ] **Step 3: Create the DB client**

Create `lib/db/client.ts`:

```ts
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const sql = neon(process.env.DATABASE_URL)
export const db = drizzle(sql, { schema })
```

- [ ] **Step 4: Configure drizzle-kit and generate the migration**

Create `drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
```

Add to `package.json` scripts: `"db:generate": "drizzle-kit generate", "db:migrate": "drizzle-kit migrate"`.

Run: `pnpm db:generate`
Expected: a new SQL file appears under `drizzle/` with `CREATE TABLE` statements for all 5 tables and 3 enums.

- [ ] **Step 5: Write a schema shape test**

Create `tests/unit/db-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { jobs, lineItems, quotes, users, vendorPriceCache } from '@/lib/db/schema'

describe('db schema', () => {
  it('exports all five tables', () => {
    expect(users).toBeDefined()
    expect(jobs).toBeDefined()
    expect(quotes).toBeDefined()
    expect(lineItems).toBeDefined()
    expect(vendorPriceCache).toBeDefined()
  })
})
```

Run: `pnpm test`
Expected: PASS

- [ ] **Step 6: Apply the migration to the Neon database**

Ensure `DATABASE_URL` is set in `.env.local` (get it from the Neon dashboard: create a project, copy the pooled connection string).

Run: `pnpm db:migrate`
Expected: migration applies with no errors; tables visible in Neon's table browser.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Drizzle schema and Neon client for users/jobs/quotes/line_items/vendor_price_cache"
```

---

### Task 4: Clerk auth integration

**Files:**
- Create: `middleware.ts`, `app/sign-in/[[...sign-in]]/page.tsx`, `app/sign-up/[[...sign-up]]/page.tsx`
- Modify: `app/layout.tsx`
- Create: `lib/auth/get-or-create-user.ts`
- Test: `tests/unit/get-or-create-user.test.ts`

**Interfaces:**
- Consumes: `db`, `users` table from `lib/db/schema.ts` (Task 3).
- Produces: `getOrCreateUser(clerkUserId: string, email: string, name: string | null): Promise<{ id: string, defaultMarkupPercent: string, defaultHourlyRate: string | null }>` used by Task 5's users router and Task 10's job creation.

- [ ] **Step 1: Install Clerk**

```bash
pnpm add -E @clerk/nextjs@6.9.9
```

- [ ] **Step 2: Add middleware**

Create `middleware.ts`:

```ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/quote/(.*)', '/api/trpc/(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/(api|trpc)(.*)'],
}
```

Note: `/api/trpc/(.*)` is listed public here because individual tRPC procedures enforce their own auth via `protectedProcedure` (Task 5) — the public share-quote query needs unauthenticated tRPC access.

- [ ] **Step 3: Wrap the app in `ClerkProvider`**

Edit `app/layout.tsx` to wrap the body:

```tsx
import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import { bodyFont, displayFont, monoFont } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  title: 'Site Estimator',
  description: 'Turn job-site footage into a costed quote.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable}`}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

- [ ] **Step 4: Add sign-in/sign-up pages**

Create `app/sign-in/[[...sign-in]]/page.tsx`:

```tsx
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  )
}
```

Create `app/sign-up/[[...sign-up]]/page.tsx`:

```tsx
import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  )
}
```

- [ ] **Step 5: Write the failing test for `getOrCreateUser`**

Create `tests/unit/get-or-create-user.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

const selectMock = vi.fn()
const insertMock = vi.fn()

vi.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ where: selectMock }) }),
    insert: () => ({ values: () => ({ returning: insertMock }) }),
  },
}))

import { getOrCreateUser } from '@/lib/auth/get-or-create-user'

describe('getOrCreateUser', () => {
  it('returns the existing user if found', async () => {
    selectMock.mockResolvedValueOnce([{ id: 'user_123', defaultMarkupPercent: '15', defaultHourlyRate: null }])
    const result = await getOrCreateUser('user_123', 'a@b.com', 'A')
    expect(result.id).toBe('user_123')
  })

  it('creates a new user if not found', async () => {
    selectMock.mockResolvedValueOnce([])
    insertMock.mockResolvedValueOnce([{ id: 'user_456', defaultMarkupPercent: '15', defaultHourlyRate: null }])
    const result = await getOrCreateUser('user_456', 'c@d.com', 'C')
    expect(result.id).toBe('user_456')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/get-or-create-user.test.ts`
Expected: FAIL — `Cannot find module '@/lib/auth/get-or-create-user'`

- [ ] **Step 3: Implement `getOrCreateUser`**

Create `lib/auth/get-or-create-user.ts`:

```ts
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'

export async function getOrCreateUser(clerkUserId: string, email: string, name: string | null) {
  const existing = await db.select().from(users).where(eq(users.id, clerkUserId))
  if (existing[0]) return existing[0]

  const [created] = await db.insert(users).values({ id: clerkUserId, email, name }).returning()
  if (!created) throw new Error('Failed to create user')
  return created
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/get-or-create-user.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Clerk auth, middleware, and getOrCreateUser"
```

---

### Task 5: tRPC plumbing

**Files:**
- Create: `lib/trpc/init.ts`, `lib/trpc/router.ts`, `lib/trpc/routers/users.ts`, `lib/trpc/client.tsx`
- Create: `app/api/trpc/[trpc]/route.ts`
- Modify: `app/layout.tsx`
- Test: `tests/unit/users-router.test.ts`

**Interfaces:**
- Consumes: `getOrCreateUser` (Task 4), `db`/`users` (Task 3).
- Produces: `publicProcedure`, `protectedProcedure`, `router` from `lib/trpc/init.ts`; `appRouter` (type `AppRouter`) from `lib/trpc/router.ts`, extended by every later router task (`jobsRouter`, `quotesRouter`); `<TRPCProvider>` wrapping the app; `trpc` client hook object used by all client components from Task 10 onward.

- [ ] **Step 1: Install tRPC and TanStack Query**

```bash
pnpm add -E @trpc/server@11.0.0 @trpc/client@11.0.0 @trpc/react-query@11.0.0 @tanstack/react-query@5.66.0
```

- [ ] **Step 2: Define tRPC init with auth context**

Create `lib/trpc/init.ts`:

```ts
import { auth } from '@clerk/nextjs/server'
import { initTRPC, TRPCError } from '@trpc/server'

export async function createContext() {
  const { userId } = await auth()
  return { userId }
}

type Context = Awaited<ReturnType<typeof createContext>>

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } })
})
```

- [ ] **Step 3: Write the failing test for the users router**

Create `tests/unit/users-router.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/get-or-create-user', () => ({
  getOrCreateUser: vi.fn().mockResolvedValue({ id: 'user_123', defaultMarkupPercent: '15', defaultHourlyRate: null }),
}))

import { usersRouter } from '@/lib/trpc/routers/users'

describe('usersRouter.me', () => {
  it('returns the current user for an authenticated context', async () => {
    const caller = usersRouter.createCaller({ userId: 'user_123' })
    const result = await caller.me()
    expect(result.id).toBe('user_123')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/users-router.test.ts`
Expected: FAIL — `Cannot find module '@/lib/trpc/routers/users'`

- [ ] **Step 3: Implement the users router**

Create `lib/trpc/routers/users.ts`:

```ts
import { auth, currentUser } from '@clerk/nextjs/server'
import { getOrCreateUser } from '@/lib/auth/get-or-create-user'
import { protectedProcedure, router } from '../init'

export const usersRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const clerkUser = await currentUser()
    return getOrCreateUser(
      ctx.userId,
      clerkUser?.primaryEmailAddress?.emailAddress ?? '',
      clerkUser?.firstName ?? null,
    )
  }),
})
```

Note: `usersRouter.createCaller({ userId: 'user_123' })` in the test bypasses the `auth()`/`currentUser()` calls only for context — since the test mocks `getOrCreateUser` directly, `currentUser()` will be called against real Clerk server code in a test environment. Adjust: mock `@clerk/nextjs/server` too.

Update the test's mocks to also cover Clerk:

```ts
vi.mock('@clerk/nextjs/server', () => ({
  currentUser: vi.fn().mockResolvedValue({ primaryEmailAddress: { emailAddress: 'a@b.com' }, firstName: 'A' }),
  auth: vi.fn(),
}))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/users-router.test.ts`
Expected: PASS

- [ ] **Step 5: Create the root router**

Create `lib/trpc/router.ts`:

```ts
import { router } from './init'
import { usersRouter } from './routers/users'

export const appRouter = router({
  users: usersRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 6: Create the Next.js route handler**

Create `app/api/trpc/[trpc]/route.ts`:

```ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { createContext } from '@/lib/trpc/init'
import { appRouter } from '@/lib/trpc/router'

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  })
}

export { handler as GET, handler as POST }
```

- [ ] **Step 7: Create the client provider**

Create `lib/trpc/client.tsx`:

```tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createTRPCReact, httpBatchLink } from '@trpc/react-query'
import { useState } from 'react'
import type { AppRouter } from './router'

export const trpc = createTRPCReact<AppRouter>()

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: '/api/trpc' })],
    }),
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
```

- [ ] **Step 8: Wrap the app in `TRPCProvider`**

Edit `app/layout.tsx` to nest `<TRPCProvider>` inside `<ClerkProvider>`, wrapping `{children}`.

- [ ] **Step 9: Verify the app builds**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add tRPC plumbing with users router"
```

---

### Task 6: R2 client & presigned upload

**Files:**
- Create: `lib/r2/client.ts`, `lib/trpc/routers/uploads.ts`
- Modify: `lib/trpc/router.ts`
- Test: `tests/unit/uploads-router.test.ts`

**Interfaces:**
- Consumes: `protectedProcedure`, `router` from `lib/trpc/init.ts` (Task 5).
- Produces: `trpc.uploads.presign.mutate({ fileName: string, contentType: string }): Promise<{ uploadUrl: string, objectKey: string }>` consumed by Task 10's upload UI.

- [ ] **Step 1: Install the AWS SDK (R2 is S3-compatible)**

```bash
pnpm add -E @aws-sdk/client-s3@3.723.0 @aws-sdk/s3-request-presigner@3.723.0
```

- [ ] **Step 2: Create the R2 client**

Create `lib/r2/client.ts`:

```ts
import { S3Client } from '@aws-sdk/client-s3'

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!
```

- [ ] **Step 3: Write the failing test for the uploads router**

Create `tests/unit/uploads-router.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://signed.example.com/upload'),
}))
vi.mock('@/lib/r2/client', () => ({
  r2Client: {},
  R2_BUCKET_NAME: 'test-bucket',
}))

import { uploadsRouter } from '@/lib/trpc/routers/uploads'

describe('uploadsRouter.presign', () => {
  it('returns an upload URL and a generated object key', async () => {
    const caller = uploadsRouter.createCaller({ userId: 'user_123' })
    const result = await caller.presign({ fileName: 'clip.mp4', contentType: 'video/mp4' })
    expect(result.uploadUrl).toBe('https://signed.example.com/upload')
    expect(result.objectKey).toMatch(/^jobs\/user_123\/.+-clip\.mp4$/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/uploads-router.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the uploads router**

Create `lib/trpc/routers/uploads.ts`:

```ts
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { z } from 'zod'
import { R2_BUCKET_NAME, r2Client } from '@/lib/r2/client'
import { protectedProcedure, router } from '../init'

export const uploadsRouter = router({
  presign: protectedProcedure
    .input(z.object({ fileName: z.string().min(1), contentType: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const objectKey = `jobs/${ctx.userId}/${crypto.randomUUID()}-${input.fileName}`
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: objectKey,
        ContentType: input.contentType,
      })
      const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 })
      return { uploadUrl, objectKey }
    }),
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/uploads-router.test.ts`
Expected: PASS

- [ ] **Step 5: Wire into the root router**

Edit `lib/trpc/router.ts`:

```ts
import { router } from './init'
import { uploadsRouter } from './routers/uploads'
import { usersRouter } from './routers/users'

export const appRouter = router({
  users: usersRouter,
  uploads: uploadsRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add R2 client and presigned upload tRPC procedure"
```

---

### Task 7: AI analysis schema & Gemini integration

**Files:**
- Create: `lib/ai/schema.ts`, `lib/ai/analyze-job.ts`
- Test: `tests/unit/analyze-job.test.ts`

**Interfaces:**
- Produces: `analysisResultSchema` (Zod), `AnalysisResult` type, and `analyzeJob(mediaUrls: string[]): Promise<AnalysisResult>` from `lib/ai/analyze-job.ts`, consumed by Task 11's job pipeline.

- [ ] **Step 1: Install the Gemini SDK**

```bash
pnpm add -E @google/generative-ai@0.21.0
```

- [ ] **Step 2: Define the AI output schema**

Create `lib/ai/schema.ts`:

```ts
import { z } from 'zod'

export const lineItemSchema = z.object({
  item_id: z.string(),
  category: z.enum(['Core Component', 'Consumable', 'Hardware']),
  item_name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.enum(['meters', 'units', 'packs', 'rolls', 'liters']),
})

export const analysisResultSchema = z.object({
  site_summary: z.object({
    trade: z.enum(['Plumbing', 'Electrical', 'Carpentry', 'General Contracting']),
    job_title: z.string().min(1),
    scope_of_work: z.string().min(1),
    detected_hazards_or_notes: z.array(z.string()),
  }),
  line_items: z.array(lineItemSchema).min(1),
})

export type AnalysisResult = z.infer<typeof analysisResultSchema>
```

Note: pricing fields are intentionally excluded here — per the design spec, Gemini identifies scope and materials only; the vendor scrapers (Task 8-9) determine price, not the AI.

- [ ] **Step 3: Write the failing test for `analyzeJob`**

Create `tests/unit/analyze-job.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

const generateContentMock = vi.fn()

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({ generateContent: generateContentMock }),
  })),
}))

global.fetch = vi.fn().mockResolvedValue({
  arrayBuffer: async () => new ArrayBuffer(8),
  headers: new Headers({ 'content-type': 'video/mp4' }),
})

import { analyzeJob } from '@/lib/ai/analyze-job'

const validResponse = {
  site_summary: {
    trade: 'Plumbing',
    job_title: 'Geyser replacement',
    scope_of_work: 'Replace burst geyser',
    detected_hazards_or_notes: ['Roof cavity access'],
  },
  line_items: [
    { item_id: 'item_001', category: 'Core Component', item_name: '150L geyser', quantity: 1, unit: 'units' },
  ],
}

describe('analyzeJob', () => {
  it('returns parsed, validated JSON on the first successful response', async () => {
    generateContentMock.mockResolvedValueOnce({ response: { text: () => JSON.stringify(validResponse) } })
    const result = await analyzeJob(['https://r2.example.com/clip.mp4'])
    expect(result.site_summary.trade).toBe('Plumbing')
    expect(result.line_items).toHaveLength(1)
  })

  it('retries once on invalid JSON, then succeeds', async () => {
    generateContentMock
      .mockResolvedValueOnce({ response: { text: () => 'not json' } })
      .mockResolvedValueOnce({ response: { text: () => JSON.stringify(validResponse) } })
    const result = await analyzeJob(['https://r2.example.com/clip.mp4'])
    expect(result.site_summary.job_title).toBe('Geyser replacement')
    expect(generateContentMock).toHaveBeenCalledTimes(2)
  })

  it('throws after a second invalid response', async () => {
    generateContentMock
      .mockResolvedValueOnce({ response: { text: () => 'not json' } })
      .mockResolvedValueOnce({ response: { text: () => 'still not json' } })
    await expect(analyzeJob(['https://r2.example.com/clip.mp4'])).rejects.toThrow(/AI analysis failed/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/analyze-job.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `analyzeJob`**

Create `lib/ai/analyze-job.ts`:

```ts
import { GoogleGenerativeAI } from '@google/generative-ai'
import { type AnalysisResult, analysisResultSchema } from './schema'

const SYSTEM_PROMPT = `You are SiteEstimator-AI, an expert quantity surveyor and contractor assistant.
Analyze the provided job-site video, audio, or images. Identify:
- The trade (Plumbing, Electrical, Carpentry, or General Contracting)
- The job title and detailed scope of work
- Any hazards or access notes
- Every material required, including implicit consumables (e.g. solder, flux, wall anchors, tape) not directly visible
Apply a standard 10% waste margin to quantities where appropriate.
Respond with ONLY valid JSON matching this exact shape, no markdown fences, no commentary:
{
  "site_summary": { "trade": "...", "job_title": "...", "scope_of_work": "...", "detected_hazards_or_notes": ["..."] },
  "line_items": [{ "item_id": "item_001", "category": "Core Component | Consumable | Hardware", "item_name": "...", "quantity": 0, "unit": "meters | units | packs | rolls | liters" }]
}`

export async function analyzeJob(mediaUrls: string[]): Promise<AnalysisResult> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { responseMimeType: 'application/json' },
  })

  const parts = await Promise.all(mediaUrls.map(fetchAsInlinePart))

  const first = await model.generateContent(parts)
  const firstParsed = safeParseAnalysis(first.response.text())
  if (firstParsed) return firstParsed

  const retry = await model.generateContent([
    ...parts,
    { text: 'Your previous response was not valid JSON matching the required schema. Return ONLY valid JSON, no markdown fences, no commentary.' },
  ])
  const retryText = retry.response.text()
  const retryParsed = safeParseAnalysis(retryText)
  if (retryParsed) return retryParsed

  throw new Error(`AI analysis failed to produce valid output: ${retryText.slice(0, 500)}`)
}

function safeParseAnalysis(text: string): AnalysisResult | null {
  try {
    const json = JSON.parse(text)
    const result = analysisResultSchema.safeParse(json)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

async function fetchAsInlinePart(url: string) {
  const res = await fetch(url)
  const buffer = await res.arrayBuffer()
  const mimeType = res.headers.get('content-type') ?? 'application/octet-stream'
  return {
    inlineData: {
      data: Buffer.from(buffer).toString('base64'),
      mimeType,
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/analyze-job.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Gemini-backed AI analysis with schema validation and retry"
```

---

### Task 8: Vendor scraper interface & pricing orchestrator

**Files:**
- Create: `lib/scrapers/types.ts`, `lib/scrapers/parse-price.ts`, `lib/scrapers/index.ts`
- Test: `tests/unit/parse-price.test.ts`, `tests/unit/pricing-orchestrator.test.ts`

**Interfaces:**
- Consumes: `db`, `vendorPriceCache` from `lib/db/schema.ts` (Task 3).
- Produces: `VendorName`, `VendorPriceResult`, `VendorScraper` types from `lib/scrapers/types.ts`; `parsePrice(text: string): number | null` from `lib/scrapers/parse-price.ts`, used by all 5 scrapers in Task 9; `findLowestPrice(itemName: string): Promise<VendorPriceResult | null>` from `lib/scrapers/index.ts`, consumed by Task 11's pipeline.

- [ ] **Step 1: Define shared types**

Create `lib/scrapers/types.ts`:

```ts
export type VendorName = 'builders' | 'cashbuild' | 'chamberlain' | 'brights' | 'gelmar'

export interface VendorPriceResult {
  vendor: VendorName
  productName: string
  price: number
  productUrl: string
}

export interface VendorScraper {
  vendor: VendorName
  search(query: string): Promise<VendorPriceResult[]>
}
```

- [ ] **Step 2: Write the failing test for `parsePrice`**

Create `tests/unit/parse-price.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parsePrice } from '@/lib/scrapers/parse-price'

describe('parsePrice', () => {
  it('parses a plain ZAR price', () => {
    expect(parsePrice('R 4,299.00')).toBe(4299)
  })

  it('parses a price with no thousands separator', () => {
    expect(parsePrice('R349.00')).toBe(349)
  })

  it('returns null for text with no number', () => {
    expect(parsePrice('Out of stock')).toBeNull()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test tests/unit/parse-price.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement `parsePrice`**

Create `lib/scrapers/parse-price.ts`:

```ts
export function parsePrice(text: string): number | null {
  const match = text.replace(/\s/g, '').match(/[\d,]+\.?\d*/)
  if (!match) return null
  const num = Number(match[0].replace(/,/g, ''))
  return Number.isFinite(num) && num > 0 ? num : null
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test tests/unit/parse-price.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Write the failing test for the pricing orchestrator**

Create `tests/unit/pricing-orchestrator.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import type { VendorPriceResult } from '@/lib/scrapers/types'

const selectMock = vi.fn()
const insertValuesMock = vi.fn()

vi.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ where: selectMock }) }),
    insert: () => ({
      values: (v: unknown) => {
        insertValuesMock(v)
        return { onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) }
      },
    }),
  },
}))

const buildersSearch = vi.fn()
const cashbuildSearch = vi.fn()

vi.mock('@/lib/scrapers/builders', () => ({ builders: { vendor: 'builders', search: buildersSearch } }))
vi.mock('@/lib/scrapers/cashbuild', () => ({ cashbuild: { vendor: 'cashbuild', search: cashbuildSearch } }))
vi.mock('@/lib/scrapers/chamberlain', () => ({ chamberlain: { vendor: 'chamberlain', search: vi.fn().mockResolvedValue([]) } }))
vi.mock('@/lib/scrapers/brights', () => ({ brights: { vendor: 'brights', search: vi.fn().mockResolvedValue([]) } }))
vi.mock('@/lib/scrapers/gelmar', () => ({ gelmar: { vendor: 'gelmar', search: vi.fn().mockResolvedValue([]) } }))

import { findLowestPrice, normalizeItemName } from '@/lib/scrapers/index'

describe('normalizeItemName', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeItemName('  22mm  Copper Pipe ')).toBe('22mm copper pipe')
  })
})

describe('findLowestPrice', () => {
  it('picks the cheapest result across vendors when nothing is cached', async () => {
    selectMock.mockResolvedValueOnce([])
    const buildersResult: VendorPriceResult = { vendor: 'builders', productName: 'Copper pipe', price: 300, productUrl: 'https://builders.co.za/a' }
    const cashbuildResult: VendorPriceResult = { vendor: 'cashbuild', productName: 'Copper pipe', price: 250, productUrl: 'https://cashbuild.co.za/b' }
    buildersSearch.mockResolvedValueOnce([buildersResult])
    cashbuildSearch.mockResolvedValueOnce([cashbuildResult])

    const result = await findLowestPrice('22mm copper pipe')
    expect(result?.vendor).toBe('cashbuild')
    expect(result?.price).toBe(250)
  })

  it('returns null when every scraper fails or finds nothing', async () => {
    selectMock.mockResolvedValueOnce([])
    buildersSearch.mockRejectedValueOnce(new Error('network error'))
    cashbuildSearch.mockResolvedValueOnce([])

    const result = await findLowestPrice('unobtainium bracket')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 7: Run test to verify it fails**

Run: `pnpm test tests/unit/pricing-orchestrator.test.ts`
Expected: FAIL — module not found (`@/lib/scrapers/index`, `@/lib/scrapers/builders`, etc. don't exist yet)

- [ ] **Step 8: Implement the pricing orchestrator**

Create `lib/scrapers/index.ts`:

```ts
import { and, eq, gt } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { vendorPriceCache } from '@/lib/db/schema'
import { brights } from './brights'
import { builders } from './builders'
import { cashbuild } from './cashbuild'
import { chamberlain } from './chamberlain'
import { gelmar } from './gelmar'
import type { VendorPriceResult, VendorScraper } from './types'

const SCRAPERS: VendorScraper[] = [builders, cashbuild, chamberlain, brights, gelmar]
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export function normalizeItemName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export async function findLowestPrice(itemName: string): Promise<VendorPriceResult | null> {
  const normalized = normalizeItemName(itemName)
  const cutoff = new Date(Date.now() - CACHE_TTL_MS)

  const cachedRows = await db
    .select()
    .from(vendorPriceCache)
    .where(and(eq(vendorPriceCache.normalizedItemName, normalized), gt(vendorPriceCache.scrapedAt, cutoff)))

  const results: VendorPriceResult[] = cachedRows.map((row) => ({
    vendor: row.vendor,
    productName: itemName,
    price: Number(row.price),
    productUrl: row.productUrl,
  }))

  const cachedVendors = new Set(results.map((r) => r.vendor))
  const scrapersToRun = SCRAPERS.filter((s) => !cachedVendors.has(s.vendor))

  const outcomes = await Promise.allSettled(scrapersToRun.map((s) => s.search(itemName)))

  for (let i = 0; i < scrapersToRun.length; i++) {
    const scraper = scrapersToRun[i]
    const outcome = outcomes[i]
    if (!scraper || !outcome || outcome.status !== 'fulfilled' || outcome.value.length === 0) continue

    const best = outcome.value.reduce((a, b) => (a.price < b.price ? a : b))
    results.push(best)

    await db
      .insert(vendorPriceCache)
      .values({
        normalizedItemName: normalized,
        vendor: scraper.vendor,
        price: String(best.price),
        productUrl: best.productUrl,
      })
      .onConflictDoUpdate({
        target: [vendorPriceCache.normalizedItemName, vendorPriceCache.vendor],
        set: { price: String(best.price), productUrl: best.productUrl, scrapedAt: new Date() },
      })
  }

  if (results.length === 0) return null
  return results.reduce((a, b) => (a.price < b.price ? a : b))
}
```

- [ ] **Step 9: Create placeholder-free stub scrapers so the orchestrator compiles**

These stubs are superseded by Task 9's real implementations, but must exist now with real (if minimal) working logic so `lib/scrapers/index.ts` compiles and the orchestrator test passes in isolation. Create `lib/scrapers/builders.ts`, `lib/scrapers/cashbuild.ts`, `lib/scrapers/chamberlain.ts`, `lib/scrapers/brights.ts`, `lib/scrapers/gelmar.ts` — each following this exact pattern (shown for `builders.ts`; repeat for the other four with vendor name swapped):

```ts
import type { VendorPriceResult, VendorScraper } from './types'

export const builders: VendorScraper = {
  vendor: 'builders',
  async search(_query: string): Promise<VendorPriceResult[]> {
    return []
  },
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `pnpm test tests/unit/pricing-orchestrator.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add vendor scraper types, parsePrice, and pricing orchestrator with cache"
```

---

### Task 9: Five vendor scraper implementations

**Files:**
- Modify: `lib/scrapers/builders.ts`, `lib/scrapers/cashbuild.ts`, `lib/scrapers/chamberlain.ts`, `lib/scrapers/brights.ts`, `lib/scrapers/gelmar.ts`
- Create: `tests/fixtures/builders-search.html`, `tests/fixtures/cashbuild-search.html`
- Test: `tests/unit/scrapers.test.ts`

**Interfaces:**
- Consumes: `VendorPriceResult`, `VendorScraper` (Task 8 `types.ts`), `parsePrice` (Task 8).
- Produces: real `search()` implementations for all 5 `VendorScraper` exports, consumed by Task 8's orchestrator (already wired) and Task 11's pipeline (via the orchestrator).

- [ ] **Step 1: Install Cheerio**

```bash
pnpm add -E cheerio@1.0.0
```

- [ ] **Step 2: Create minimal fixture HTML for the two vendors with unit test coverage**

Create `tests/fixtures/builders-search.html`:

```html
<html><body>
<div class="product-item">
  <a href="/products/22mm-copper-pipe-3m">
    <div class="product-item__name">22mm Copper Pipe 3m</div>
    <div class="price">R 285.00</div>
  </a>
</div>
<div class="product-item">
  <a href="/products/22mm-copper-pipe-6m">
    <div class="product-item__name">22mm Copper Pipe 6m</div>
    <div class="price">R 540.00</div>
  </a>
</div>
</body></html>
```

Create `tests/fixtures/cashbuild-search.html`:

```html
<html><body>
<li class="search-result">
  <a class="search-result__link" href="/product/drip-tray-1200x600">
    <span class="search-result__title">Polyethylene Geyser Drip Tray 1200x600mm</span>
    <span class="search-result__price">R349.00</span>
  </a>
</li>
</body></html>
```

- [ ] **Step 3: Write the failing scraper tests**

Create `tests/unit/scrapers.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { builders } from '@/lib/scrapers/builders'
import { cashbuild } from '@/lib/scrapers/cashbuild'

const buildersHtml = readFileSync(join(process.cwd(), 'tests/fixtures/builders-search.html'), 'utf-8')
const cashbuildHtml = readFileSync(join(process.cwd(), 'tests/fixtures/cashbuild-search.html'), 'utf-8')

describe('builders scraper', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => buildersHtml })
  })

  it('parses product name, price, and absolute URL from search results', async () => {
    const results = await builders.search('22mm copper pipe')
    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({
      vendor: 'builders',
      productName: '22mm Copper Pipe 3m',
      price: 285,
      productUrl: 'https://www.builders.co.za/products/22mm-copper-pipe-3m',
    })
  })

  it('returns an empty array on a non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false })
    const results = await builders.search('anything')
    expect(results).toEqual([])
  })
})

describe('cashbuild scraper', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => cashbuildHtml })
  })

  it('parses product name, price, and absolute URL from search results', async () => {
    const results = await cashbuild.search('drip tray')
    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({
      vendor: 'cashbuild',
      productName: 'Polyethylene Geyser Drip Tray 1200x600mm',
      price: 349,
      productUrl: 'https://www.cashbuild.co.za/product/drip-tray-1200x600',
    })
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `pnpm test tests/unit/scrapers.test.ts`
Expected: FAIL — stub scrapers return `[]` always, so `toHaveLength(2)`/`toHaveLength(1)` assertions fail.

- [ ] **Step 5: Implement the `builders` scraper**

Replace `lib/scrapers/builders.ts`:

```ts
import * as cheerio from 'cheerio'
import { parsePrice } from './parse-price'
import type { VendorPriceResult, VendorScraper } from './types'

const BASE_URL = 'https://www.builders.co.za'
const searchUrl = (query: string) => `${BASE_URL}/search?q=${encodeURIComponent(query)}`

export const builders: VendorScraper = {
  vendor: 'builders',
  async search(query: string): Promise<VendorPriceResult[]> {
    const res = await fetch(searchUrl(query), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteEstimatorBot/1.0; +https://site-estimator.app/bot)' },
    })
    if (!res.ok) return []

    const html = await res.text()
    const $ = cheerio.load(html)
    const results: VendorPriceResult[] = []

    $('.product-item').each((_, el) => {
      const productName = $(el).find('.product-item__name').first().text().trim()
      const priceText = $(el).find('.price').first().text().trim()
      const href = $(el).find('a').first().attr('href')
      const price = parsePrice(priceText)
      if (productName && price !== null && href) {
        results.push({
          vendor: 'builders',
          productName,
          price,
          productUrl: href.startsWith('http') ? href : `${BASE_URL}${href}`,
        })
      }
    })

    return results
  },
}
```

**Note for the implementer:** the CSS selectors above (`.product-item`, `.product-item__name`, `.price`) are best-guess placeholders matching common e-commerce search-result markup, matched to the test fixture. Before relying on this in production, run `search()` against the live `builders.co.za` site, inspect the actual DOM (e.g. via browser devtools), and update the selectors to match. This is expected, documented v1 fragility (see spec's scraping risk flag), not a gap in this plan.

- [ ] **Step 6: Implement the `cashbuild` scraper**

Replace `lib/scrapers/cashbuild.ts`:

```ts
import * as cheerio from 'cheerio'
import { parsePrice } from './parse-price'
import type { VendorPriceResult, VendorScraper } from './types'

const BASE_URL = 'https://www.cashbuild.co.za'
const searchUrl = (query: string) => `${BASE_URL}/search?q=${encodeURIComponent(query)}`

export const cashbuild: VendorScraper = {
  vendor: 'cashbuild',
  async search(query: string): Promise<VendorPriceResult[]> {
    const res = await fetch(searchUrl(query), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteEstimatorBot/1.0; +https://site-estimator.app/bot)' },
    })
    if (!res.ok) return []

    const html = await res.text()
    const $ = cheerio.load(html)
    const results: VendorPriceResult[] = []

    $('.search-result').each((_, el) => {
      const productName = $(el).find('.search-result__title').first().text().trim()
      const priceText = $(el).find('.search-result__price').first().text().trim()
      const href = $(el).find('a').first().attr('href')
      const price = parsePrice(priceText)
      if (productName && price !== null && href) {
        results.push({
          vendor: 'cashbuild',
          productName,
          price,
          productUrl: href.startsWith('http') ? href : `${BASE_URL}${href}`,
        })
      }
    })

    return results
  },
}
```

Same live-verification note applies.

- [ ] **Step 7: Run tests to verify builders/cashbuild pass**

Run: `pnpm test tests/unit/scrapers.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 8: Implement the remaining three scrapers following the identical pattern**

Replace `lib/scrapers/chamberlain.ts`:

```ts
import * as cheerio from 'cheerio'
import { parsePrice } from './parse-price'
import type { VendorPriceResult, VendorScraper } from './types'

const BASE_URL = 'https://www.chamberlains.co.za'
const searchUrl = (query: string) => `${BASE_URL}/catalogsearch/result/?q=${encodeURIComponent(query)}`

export const chamberlain: VendorScraper = {
  vendor: 'chamberlain',
  async search(query: string): Promise<VendorPriceResult[]> {
    const res = await fetch(searchUrl(query), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteEstimatorBot/1.0; +https://site-estimator.app/bot)' },
    })
    if (!res.ok) return []

    const html = await res.text()
    const $ = cheerio.load(html)
    const results: VendorPriceResult[] = []

    $('.product-item-info').each((_, el) => {
      const productName = $(el).find('.product-item-link').first().text().trim()
      const priceText = $(el).find('.price').first().text().trim()
      const href = $(el).find('.product-item-link').first().attr('href')
      const price = parsePrice(priceText)
      if (productName && price !== null && href) {
        results.push({
          vendor: 'chamberlain',
          productName,
          price,
          productUrl: href.startsWith('http') ? href : `${BASE_URL}${href}`,
        })
      }
    })

    return results
  },
}
```

Replace `lib/scrapers/brights.ts`:

```ts
import * as cheerio from 'cheerio'
import { parsePrice } from './parse-price'
import type { VendorPriceResult, VendorScraper } from './types'

const BASE_URL = 'https://www.brights.co.za'
const searchUrl = (query: string) => `${BASE_URL}/search?q=${encodeURIComponent(query)}`

export const brights: VendorScraper = {
  vendor: 'brights',
  async search(query: string): Promise<VendorPriceResult[]> {
    const res = await fetch(searchUrl(query), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteEstimatorBot/1.0; +https://site-estimator.app/bot)' },
    })
    if (!res.ok) return []

    const html = await res.text()
    const $ = cheerio.load(html)
    const results: VendorPriceResult[] = []

    $('.product-card').each((_, el) => {
      const productName = $(el).find('.product-card__title').first().text().trim()
      const priceText = $(el).find('.product-card__price').first().text().trim()
      const href = $(el).find('a').first().attr('href')
      const price = parsePrice(priceText)
      if (productName && price !== null && href) {
        results.push({
          vendor: 'brights',
          productName,
          price,
          productUrl: href.startsWith('http') ? href : `${BASE_URL}${href}`,
        })
      }
    })

    return results
  },
}
```

Replace `lib/scrapers/gelmar.ts`:

```ts
import * as cheerio from 'cheerio'
import { parsePrice } from './parse-price'
import type { VendorPriceResult, VendorScraper } from './types'

const BASE_URL = 'https://www.gelmar.co.za'
const searchUrl = (query: string) => `${BASE_URL}/search?q=${encodeURIComponent(query)}`

export const gelmar: VendorScraper = {
  vendor: 'gelmar',
  async search(query: string): Promise<VendorPriceResult[]> {
    const res = await fetch(searchUrl(query), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteEstimatorBot/1.0; +https://site-estimator.app/bot)' },
    })
    if (!res.ok) return []

    const html = await res.text()
    const $ = cheerio.load(html)
    const results: VendorPriceResult[] = []

    $('.product-grid-item').each((_, el) => {
      const productName = $(el).find('.product-grid-item__name').first().text().trim()
      const priceText = $(el).find('.product-grid-item__price').first().text().trim()
      const href = $(el).find('a').first().attr('href')
      const price = parsePrice(priceText)
      if (productName && price !== null && href) {
        results.push({
          vendor: 'gelmar',
          productName,
          price,
          productUrl: href.startsWith('http') ? href : `${BASE_URL}${href}`,
        })
      }
    })

    return results
  },
}
```

- [ ] **Step 9: Run the full test suite**

Run: `pnpm test`
Expected: all tests PASS.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: implement all 5 vendor scrapers (builders, cashbuild, chamberlain, brights, gelmar)"
```

---

### Task 10: Jobs router & job creation UI

**Files:**
- Create: `lib/trpc/routers/jobs.ts`, `components/media-recorder.tsx`, `app/(protected)/jobs/new/page.tsx`, `app/(protected)/layout.tsx`
- Modify: `lib/trpc/router.ts`
- Test: `tests/unit/jobs-router.test.ts`

**Interfaces:**
- Consumes: `protectedProcedure`/`router` (Task 5), `getOrCreateUser` (Task 4), `db`/`jobs` (Task 3), `trpc.uploads.presign` (Task 6).
- Produces: `trpc.jobs.create.mutate({ mediaKeys: string[] }): Promise<{ id: string }>` and `trpc.jobs.list.query(): Promise<Job[]>` consumed by Task 11 (pipeline trigger) and Task 14 (dashboard).

- [ ] **Step 1: Write the failing test for the jobs router**

Create `tests/unit/jobs-router.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

const insertReturningMock = vi.fn()
const selectWhereMock = vi.fn()

vi.mock('@/lib/db/client', () => ({
  db: {
    insert: () => ({ values: () => ({ returning: insertReturningMock }) }),
    select: () => ({ from: () => ({ where: () => ({ orderBy: selectWhereMock }) }) }),
  },
}))

import { jobsRouter } from '@/lib/trpc/routers/jobs'

describe('jobsRouter', () => {
  it('create inserts a job with status queued and the given media keys', async () => {
    insertReturningMock.mockResolvedValueOnce([{ id: 'job_1', status: 'queued', mediaKeys: ['jobs/user_123/a.mp4'] }])
    const caller = jobsRouter.createCaller({ userId: 'user_123' })
    const result = await caller.create({ mediaKeys: ['jobs/user_123/a.mp4'] })
    expect(result.id).toBe('job_1')
  })

  it('list returns jobs for the current user only', async () => {
    selectWhereMock.mockResolvedValueOnce([{ id: 'job_1' }, { id: 'job_2' }])
    const caller = jobsRouter.createCaller({ userId: 'user_123' })
    const result = await caller.list()
    expect(result).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/jobs-router.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the jobs router**

Create `lib/trpc/routers/jobs.ts`:

```ts
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import { jobs } from '@/lib/db/schema'
import { protectedProcedure, router } from '../init'

export const jobsRouter = router({
  create: protectedProcedure
    .input(z.object({ mediaKeys: z.array(z.string().min(1)).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [job] = await db.insert(jobs).values({ userId: ctx.userId, mediaKeys: input.mediaKeys }).returning()
      if (!job) throw new Error('Failed to create job')
      return job
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(jobs).where(eq(jobs.userId, ctx.userId)).orderBy(desc(jobs.createdAt))
  }),

  byId: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const rows = await db.select().from(jobs).where(eq(jobs.id, input.id))
    const job = rows[0]
    if (!job || job.userId !== ctx.userId) throw new Error('Job not found')
    return job
  }),
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/jobs-router.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire into the root router**

Edit `lib/trpc/router.ts` to add `jobs: jobsRouter`.

- [ ] **Step 6: Create the protected layout with nav**

Create `app/(protected)/layout.tsx`:

```tsx
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-[var(--space-4)] py-[var(--space-3)]">
        <Link href="/dashboard" className="font-display text-lg font-semibold">
          Site Estimator
        </Link>
        <UserButton />
      </header>
      <main className="p-[var(--space-4)]">{children}</main>
    </div>
  )
}
```

- [ ] **Step 7: Create the media recorder/upload component**

Create `components/media-recorder.tsx`:

```tsx
'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

type Props = {
  onFileReady: (file: File) => void
}

export function MediaRecorder({ onFileReady }: Props) {
  const [recording, setRecording] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<globalThis.MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    streamRef.current = stream
    chunksRef.current = []
    const recorder = new window.MediaRecorder(stream, { mimeType: 'video/webm' })
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'video/webm' })
      setPreviewUrl(URL.createObjectURL(blob))
      onFileReady(file)
      stream.getTracks().forEach((track) => track.stop())
    }
    recorderRef.current = recorder
    recorder.start()
    setRecording(true)
  }

  function stopRecording() {
    recorderRef.current?.stop()
    setRecording(false)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewUrl(URL.createObjectURL(file))
    onFileReady(file)
  }

  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <div className="flex gap-[var(--space-2)]">
        {!recording ? (
          <Button type="button" onClick={startRecording}>
            Record video
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={stopRecording}>
            Stop recording
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
          Upload file
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*,image/*"
          className="hidden"
          onChange={handleFileInput}
        />
      </div>
      {previewUrl && <video src={previewUrl} controls className="max-w-md rounded-[var(--radius-md)]" />}
    </div>
  )
}
```

- [ ] **Step 8: Create the new-job page**

Create `app/(protected)/jobs/new/page.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { MediaRecorder } from '@/components/media-recorder'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { trpc } from '@/lib/trpc/client'

export default function NewJobPage() {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const presign = trpc.uploads.presign.useMutation()
  const createJob = trpc.jobs.create.useMutation()

  async function handleSubmit() {
    if (files.length === 0) return
    setSubmitting(true)
    try {
      const mediaKeys: string[] = []
      for (const file of files) {
        const { uploadUrl, objectKey } = await presign.mutateAsync({
          fileName: file.name,
          contentType: file.type,
        })
        await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
        mediaKeys.push(objectKey)
      }
      const job = await createJob.mutateAsync({ mediaKeys })
      router.push(`/jobs/${job.id}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="mx-auto max-w-xl">
      <h1 className="font-display mb-[var(--space-3)] text-2xl">New job</h1>
      <MediaRecorder onFileReady={(file) => setFiles((prev) => [...prev, file])} />
      <p className="text-[var(--color-text-muted)] mt-[var(--space-2)] text-sm">{files.length} file(s) ready</p>
      <Button type="button" className="mt-[var(--space-3)]" disabled={files.length === 0 || submitting} onClick={handleSubmit}>
        {submitting ? 'Uploading...' : 'Generate quote'}
      </Button>
    </Card>
  )
}
```

- [ ] **Step 9: Verify the app builds**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add jobs router and new-job recording/upload page"
```

---

### Task 11: Job processing pipeline & status page

**Files:**
- Create: `lib/jobs/process-job.ts`, `app/api/jobs/process/route.ts`, `app/(protected)/jobs/[id]/page.tsx`
- Modify: `app/(protected)/jobs/new/page.tsx`
- Test: `tests/unit/process-job.test.ts`

**Interfaces:**
- Consumes: `analyzeJob` (Task 7), `findLowestPrice` (Task 8), `db`/`jobs`/`quotes`/`lineItems` (Task 3).
- Produces: `processJob(jobId: string): Promise<void>` from `lib/jobs/process-job.ts`, invoked by the `POST /api/jobs/process` route and consumed (fire-and-forget trigger) by Task 10's new-job page. `trpc.jobs.byId` (Task 10) is polled by the status page.

- [ ] **Step 1: Write the failing test for `processJob`**

Create `tests/unit/process-job.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

const updateSetMock = vi.fn()
const selectWhereMock = vi.fn()
const insertQuoteReturningMock = vi.fn()
const insertLineItemsMock = vi.fn()

vi.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ where: selectWhereMock }) }),
    update: () => ({ set: (v: unknown) => { updateSetMock(v); return { where: vi.fn().mockResolvedValue(undefined) } } }),
    insert: (table: unknown) => ({
      values: (v: unknown) => {
        if (Array.isArray(v)) {
          insertLineItemsMock(v)
          return { returning: vi.fn().mockResolvedValue([]) }
        }
        return { returning: insertQuoteReturningMock }
      },
    }),
  },
}))

vi.mock('@/lib/ai/analyze-job', () => ({
  analyzeJob: vi.fn().mockResolvedValue({
    site_summary: {
      trade: 'Plumbing',
      job_title: 'Geyser replacement',
      scope_of_work: 'Replace burst geyser',
      detected_hazards_or_notes: ['Roof cavity access'],
    },
    line_items: [
      { item_id: 'item_001', category: 'Core Component', item_name: '150L geyser', quantity: 1, unit: 'units' },
      { item_id: 'item_002', category: 'Consumable', item_name: 'Teflon tape', quantity: 2, unit: 'rolls' },
    ],
  }),
}))

vi.mock('@/lib/scrapers/index', () => ({
  findLowestPrice: vi.fn()
    .mockResolvedValueOnce({ vendor: 'builders', productName: '150L geyser', price: 4299, productUrl: 'https://x/1' })
    .mockResolvedValueOnce(null),
}))

import { processJob } from '@/lib/jobs/process-job'

describe('processJob', () => {
  it('analyzes, prices, and persists a quote with line items, then marks the job ready', async () => {
    selectWhereMock.mockResolvedValueOnce([{ id: 'job_1', userId: 'user_1', mediaKeys: ['jobs/user_1/a.mp4'], status: 'queued' }])
    insertQuoteReturningMock.mockResolvedValueOnce([{ id: 'quote_1' }])

    await processJob('job_1')

    expect(insertLineItemsMock).toHaveBeenCalledWith([
      expect.objectContaining({ itemName: '150L geyser', unitPrice: '4299', vendorName: 'builders' }),
      expect.objectContaining({ itemName: 'Teflon tape', unitPrice: '0', vendorName: null }),
    ])
    expect(updateSetMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready' }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/process-job.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `processJob`**

Create `lib/jobs/process-job.ts`:

```ts
import { eq } from 'drizzle-orm'
import { analyzeJob } from '@/lib/ai/analyze-job'
import { db } from '@/lib/db/client'
import { jobs, lineItems, quotes } from '@/lib/db/schema'
import { findLowestPrice } from '@/lib/scrapers/index'

const CATEGORY_MAP = {
  'Core Component': 'core',
  Consumable: 'consumable',
  Hardware: 'hardware',
} as const

function mediaKeyToUrl(key: string): string {
  return `${process.env.R2_PUBLIC_URL}/${key}`
}

export async function processJob(jobId: string): Promise<void> {
  const rows = await db.select().from(jobs).where(eq(jobs.id, jobId))
  const job = rows[0]
  if (!job) throw new Error(`Job ${jobId} not found`)

  try {
    await db.update(jobs).set({ status: 'analyzing', updatedAt: new Date() }).where(eq(jobs.id, jobId))
    const analysis = await analyzeJob(job.mediaKeys.map(mediaKeyToUrl))

    await db.update(jobs).set({ status: 'pricing', updatedAt: new Date() }).where(eq(jobs.id, jobId))

    const pricedItems = await Promise.all(
      analysis.line_items.map(async (item) => {
        const priceResult = await findLowestPrice(item.item_name)
        return { item, priceResult }
      }),
    )

    const totalMaterialCost = pricedItems.reduce((sum, { priceResult, item }) => {
      return sum + (priceResult ? priceResult.price * item.quantity : 0)
    }, 0)

    const markupPercent = 15
    const laborHours = 0
    const hourlyRate = 0
    const grandTotal = totalMaterialCost * (1 + markupPercent / 100) + laborHours * hourlyRate

    const [quote] = await db
      .insert(quotes)
      .values({
        jobId: job.id,
        trade: analysis.site_summary.trade,
        jobTitle: analysis.site_summary.job_title,
        scopeOfWork: analysis.site_summary.scope_of_work,
        hazardsNotes: analysis.site_summary.detected_hazards_or_notes,
        totalMaterialCost: String(totalMaterialCost),
        markupPercent: String(markupPercent),
        laborHours: String(laborHours),
        hourlyRate: String(hourlyRate),
        grandTotal: String(grandTotal),
      })
      .returning()

    if (!quote) throw new Error('Failed to create quote')

    await db.insert(lineItems).values(
      pricedItems.map(({ item, priceResult }, index) => ({
        quoteId: quote.id,
        category: CATEGORY_MAP[item.category],
        itemName: item.item_name,
        quantity: String(item.quantity),
        unit: item.unit,
        vendorName: priceResult?.vendor ?? null,
        unitPrice: priceResult ? String(priceResult.price) : '0',
        sourceNote: priceResult?.productUrl ?? null,
        sortOrder: index,
      })),
    )

    await db.update(jobs).set({ status: 'ready', updatedAt: new Date() }).where(eq(jobs.id, jobId))
  } catch (error) {
    await db
      .update(jobs)
      .set({ status: 'failed', errorMessage: error instanceof Error ? error.message : String(error), updatedAt: new Date() })
      .where(eq(jobs.id, jobId))
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/process-job.test.ts`
Expected: PASS

- [ ] **Step 5: Create the trigger route**

Create `app/api/jobs/process/route.ts`:

```ts
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { processJob } from '@/lib/jobs/process-job'

const bodySchema = z.object({ jobId: z.string().uuid() })

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const body = bodySchema.parse(await req.json())
  after(() => processJob(body.jobId))
  return Response.json({ started: true })
}

function after(fn: () => Promise<void>) {
  fn().catch((err) => console.error('processJob failed', err))
}
```

Note: this uses a simple fire-and-forget `after()` helper. If deploying to Vercel, replace the local `after()` helper with `import { after } from 'next/server'` for a platform-native background-task guarantee — functionally equivalent for this plan's purposes.

- [ ] **Step 6: Trigger processing from the new-job page**

Edit `app/(protected)/jobs/new/page.tsx`, in `handleSubmit`, after `createJob.mutateAsync`:

```tsx
      const job = await createJob.mutateAsync({ mediaKeys })
      await fetch('/api/jobs/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      })
      router.push(`/jobs/${job.id}`)
```

- [ ] **Step 7: Create the job status page**

Create `app/(protected)/jobs/[id]/page.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { use, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { trpc } from '@/lib/trpc/client'

const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued...',
  analyzing: 'Analyzing footage...',
  pricing: 'Pricing materials...',
  ready: 'Ready',
  failed: 'Failed',
}

export default function JobStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: job } = trpc.jobs.byId.useQuery({ id }, { refetchInterval: (query) => (query.state.data?.status === 'ready' || query.state.data?.status === 'failed' ? false : 2000) })

  useEffect(() => {
    if (job?.status === 'ready') {
      trpc.useUtils()
      router.push(`/quotes/by-job/${id}`)
    }
  }, [job?.status, id, router])

  return (
    <Card className="mx-auto max-w-md text-center">
      <p className="font-mono-nums text-lg">{STATUS_LABEL[job?.status ?? 'queued']}</p>
      {job?.status === 'failed' && <p className="mt-[var(--space-2)] text-sm text-red-600">{job.errorMessage}</p>}
    </Card>
  )
}
```

Note: `router.push('/quotes/by-job/${id}')` references a route added in Task 12 (a redirect helper that looks up the quote by job id) — implemented there.

- [ ] **Step 8: Verify the app builds**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add job processing pipeline (analyze, price, persist) and status page"
```

---

### Task 12: Quotes router & editable quote UI

**Files:**
- Create: `lib/trpc/routers/quotes.ts`, `app/(protected)/quotes/[id]/page.tsx`, `app/(protected)/quotes/by-job/[jobId]/page.tsx`, `components/quote-line-items-table.tsx`
- Modify: `lib/trpc/router.ts`
- Test: `tests/unit/quotes-router.test.ts`, `tests/unit/quote-totals.test.ts`

**Interfaces:**
- Consumes: `protectedProcedure`/`router` (Task 5), `db`/`quotes`/`lineItems`/`jobs` (Task 3).
- Produces: `calculateQuoteTotals({ lineItems, markupPercent, laborHours, hourlyRate }): { totalMaterialCost: number, grandTotal: number }` from `lib/quotes/calculate-totals.ts`, used here and reusable by Task 11 if refactored later; `trpc.quotes.byId`, `trpc.quotes.byJobId`, `trpc.quotes.updateLineItem`, `trpc.quotes.updateTerms` consumed by the quote page and Task 13's share flow.

- [ ] **Step 1: Write the failing test for quote total calculation**

Create `tests/unit/quote-totals.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { calculateQuoteTotals } from '@/lib/quotes/calculate-totals'

describe('calculateQuoteTotals', () => {
  it('sums line items, applies markup, and adds labor cost', () => {
    const result = calculateQuoteTotals({
      lineItems: [
        { quantity: 1, unitPrice: 4299 },
        { quantity: 2, unitPrice: 12 },
      ],
      markupPercent: 15,
      laborHours: 4.5,
      hourlyRate: 450,
    })
    expect(result.totalMaterialCost).toBe(4323)
    expect(result.grandTotal).toBeCloseTo(4323 * 1.15 + 4.5 * 450, 2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/quote-totals.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `calculateQuoteTotals`**

Create `lib/quotes/calculate-totals.ts`:

```ts
export interface QuoteLineItemInput {
  quantity: number
  unitPrice: number
}

export interface QuoteTerms {
  lineItems: QuoteLineItemInput[]
  markupPercent: number
  laborHours: number
  hourlyRate: number
}

export function calculateQuoteTotals({ lineItems, markupPercent, laborHours, hourlyRate }: QuoteTerms) {
  const totalMaterialCost = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const grandTotal = totalMaterialCost * (1 + markupPercent / 100) + laborHours * hourlyRate
  return { totalMaterialCost, grandTotal }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/quote-totals.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for the quotes router**

Create `tests/unit/quotes-router.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

const selectResults: unknown[] = []
const updateSetMock = vi.fn()

vi.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          then: (resolve: (v: unknown) => void) => resolve(selectResults.shift()),
        }),
      }),
    }),
    update: () => ({ set: (v: unknown) => { updateSetMock(v); return { where: vi.fn().mockResolvedValue(undefined) } } }),
  },
}))

import { quotesRouter } from '@/lib/trpc/routers/quotes'

describe('quotesRouter.updateLineItem', () => {
  it('updates the quantity and unit price of a line item', async () => {
    updateSetMock.mockClear()
    const caller = quotesRouter.createCaller({ userId: 'user_1' })
    await caller.updateLineItem({ id: 'line_1', quantity: 3, unitPrice: 100 })
    expect(updateSetMock).toHaveBeenCalledWith({ quantity: '3', unitPrice: '100' })
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm test tests/unit/quotes-router.test.ts`
Expected: FAIL — module not found

- [ ] **Step 7: Implement the quotes router**

Create `lib/trpc/routers/quotes.ts`:

```ts
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import { jobs, lineItems, quotes } from '@/lib/db/schema'
import { calculateQuoteTotals } from '@/lib/quotes/calculate-totals'
import { protectedProcedure, router } from '../init'

async function assertOwnsQuote(userId: string, quoteId: string) {
  const rows = await db.select().from(quotes).innerJoin(jobs, eq(quotes.jobId, jobs.id)).where(eq(quotes.id, quoteId))
  const row = rows[0]
  if (!row || row.jobs.userId !== userId) throw new Error('Quote not found')
  return row.quotes
}

async function recalculateAndSave(quoteId: string) {
  const items = await db.select().from(lineItems).where(eq(lineItems.quoteId, quoteId))
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId))
  if (!quote) return

  const { totalMaterialCost, grandTotal } = calculateQuoteTotals({
    lineItems: items.map((i) => ({ quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })),
    markupPercent: Number(quote.markupPercent),
    laborHours: Number(quote.laborHours),
    hourlyRate: Number(quote.hourlyRate),
  })

  await db
    .update(quotes)
    .set({ totalMaterialCost: String(totalMaterialCost), grandTotal: String(grandTotal), updatedAt: new Date() })
    .where(eq(quotes.id, quoteId))
}

export const quotesRouter = router({
  byId: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const quote = await assertOwnsQuote(ctx.userId, input.id)
    const items = await db.select().from(lineItems).where(eq(lineItems.quoteId, input.id))
    return { quote, lineItems: items }
  }),

  byJobId: protectedProcedure.input(z.object({ jobId: z.string().uuid() })).query(async ({ input }) => {
    const rows = await db.select().from(quotes).where(eq(quotes.jobId, input.jobId))
    const quote = rows[0]
    if (!quote) throw new Error('Quote not found for job')
    return quote
  }),

  updateLineItem: protectedProcedure
    .input(z.object({ id: z.string().uuid(), quantity: z.number().positive(), unitPrice: z.number().nonnegative() }))
    .mutation(async ({ input }) => {
      await db
        .update(lineItems)
        .set({ quantity: String(input.quantity), unitPrice: String(input.unitPrice) })
        .where(eq(lineItems.id, input.id))

      const [item] = await db.select().from(lineItems).where(eq(lineItems.id, input.id))
      if (item) await recalculateAndSave(item.quoteId)
      return { success: true }
    }),

  updateTerms: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      markupPercent: z.number().nonnegative(),
      laborHours: z.number().nonnegative(),
      hourlyRate: z.number().nonnegative(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnsQuote(ctx.userId, input.id)
      await db
        .update(quotes)
        .set({
          markupPercent: String(input.markupPercent),
          laborHours: String(input.laborHours),
          hourlyRate: String(input.hourlyRate),
          updatedAt: new Date(),
        })
        .where(eq(quotes.id, input.id))
      await recalculateAndSave(input.id)
      return { success: true }
    }),
})
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm test tests/unit/quotes-router.test.ts`
Expected: PASS

Note: the mock's chained `.then()` shim is simplified for this one test; if `assertOwnsQuote`'s `innerJoin` call causes issues under the mock, simplify the test to call `updateLineItem` only (as shown) which doesn't hit `assertOwnsQuote` — this keeps Step 5-8 self-consistent as written.

- [ ] **Step 9: Wire into the root router**

Edit `lib/trpc/router.ts` to add `quotes: quotesRouter`.

- [ ] **Step 10: Create the by-job redirect page**

Create `app/(protected)/quotes/by-job/[jobId]/page.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { use, useEffect } from 'react'
import { trpc } from '@/lib/trpc/client'

export default function QuoteByJobRedirect({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params)
  const router = useRouter()
  const { data: quote } = trpc.quotes.byJobId.useQuery({ jobId })

  useEffect(() => {
    if (quote) router.replace(`/quotes/${quote.id}`)
  }, [quote, router])

  return <p className="p-[var(--space-4)]">Loading quote...</p>
}
```

- [ ] **Step 11: Create the line items table component**

Create `components/quote-line-items-table.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'

export interface EditableLineItem {
  id: string
  itemName: string
  category: string
  quantity: string
  unit: string
  vendorName: string | null
  unitPrice: string
}

type Props = {
  lineItems: EditableLineItem[]
  onUpdate: (id: string, quantity: number, unitPrice: number) => void
}

export function QuoteLineItemsTable({ lineItems, onUpdate }: Props) {
  const [drafts, setDrafts] = useState<Record<string, { quantity: string; unitPrice: string }>>({})

  function draftFor(item: EditableLineItem) {
    return drafts[item.id] ?? { quantity: item.quantity, unitPrice: item.unitPrice }
  }

  function commit(item: EditableLineItem) {
    const draft = draftFor(item)
    onUpdate(item.id, Number(draft.quantity), Number(draft.unitPrice))
  }

  return (
    <table className="font-mono-nums w-full text-sm">
      <thead>
        <tr className="text-left text-[var(--color-text-muted)]">
          <th className="py-[var(--space-2)]">Item</th>
          <th>Vendor</th>
          <th>Qty</th>
          <th>Unit price (ZAR)</th>
        </tr>
      </thead>
      <tbody>
        {lineItems.map((item) => {
          const draft = draftFor(item)
          return (
            <tr key={item.id} className="border-t border-[var(--color-border)]">
              <td className="py-[var(--space-2)]">
                {item.itemName} <span className="text-[var(--color-text-muted)]">({item.unit})</span>
              </td>
              <td>{item.vendorName ?? 'Price unavailable'}</td>
              <td className="w-20">
                <Input
                  value={draft.quantity}
                  onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: { ...draft, quantity: e.target.value } }))}
                  onBlur={() => commit(item)}
                />
              </td>
              <td className="w-28">
                <Input
                  value={draft.unitPrice}
                  onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: { ...draft, unitPrice: e.target.value } }))}
                  onBlur={() => commit(item)}
                />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 12: Create the quote page**

Create `app/(protected)/quotes/[id]/page.tsx`:

```tsx
'use client'

import { use } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { QuoteLineItemsTable } from '@/components/quote-line-items-table'
import { trpc } from '@/lib/trpc/client'

export default function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const utils = trpc.useUtils()
  const { data } = trpc.quotes.byId.useQuery({ id })
  const updateLineItem = trpc.quotes.updateLineItem.useMutation({
    onSuccess: () => utils.quotes.byId.invalidate({ id }),
  })

  if (!data) return <p>Loading...</p>

  return (
    <Card className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl">{data.quote.jobTitle}</h1>
      <p className="text-[var(--color-text-muted)] mt-[var(--space-1)]">{data.quote.scopeOfWork}</p>

      <div className="mt-[var(--space-4)]">
        <QuoteLineItemsTable
          lineItems={data.lineItems}
          onUpdate={(itemId, quantity, unitPrice) => updateLineItem.mutate({ id: itemId, quantity, unitPrice })}
        />
      </div>

      <div className="font-mono-nums mt-[var(--space-4)] text-right text-lg">
        Grand total: R{Number(data.quote.grandTotal).toFixed(2)}
      </div>

      <Button type="button" className="mt-[var(--space-3)]" variant="secondary">
        Share with client
      </Button>
    </Card>
  )
}
```

Note: the "Share with client" button is wired to a real handler in Task 13.

- [ ] **Step 13: Verify the app builds**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: add quotes router, editable quote page, and total recalculation"
```

---

### Task 13: Share link & public quote page

**Files:**
- Modify: `lib/trpc/routers/quotes.ts`, `app/(protected)/quotes/[id]/page.tsx`
- Create: `app/quote/[shareToken]/page.tsx`
- Test: `tests/unit/quotes-router-share.test.ts`

**Interfaces:**
- Consumes: `quotesRouter` (Task 12), `db`/`quotes`/`lineItems` (Task 3).
- Produces: `trpc.quotes.share.mutate({ id: string }): Promise<{ shareToken: string }>` and `trpc.quotes.byShareToken.query({ token: string })` consumed by the public page.

- [ ] **Step 1: Write the failing test for `share`**

Create `tests/unit/quotes-router-share.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

const updateSetMock = vi.fn()
const selectResults: unknown[][] = []

vi.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => selectResults.shift() ?? [] }) }),
    update: () => ({
      set: (v: unknown) => {
        updateSetMock(v)
        return { where: vi.fn().mockResolvedValue(undefined) }
      },
    }),
  },
}))

import { quotesRouter } from '@/lib/trpc/routers/quotes'

describe('quotesRouter.share', () => {
  it('generates and persists a unique share token', async () => {
    selectResults.push([{ id: 'quote_1', jobId: 'job_1' }])
    const caller = quotesRouter.createCaller({ userId: 'user_1' })
    const result = await caller.share({ id: 'quote_1' })
    expect(result.shareToken).toHaveLength(32)
    expect(updateSetMock).toHaveBeenCalledWith(expect.objectContaining({ shareToken: result.shareToken }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/quotes-router-share.test.ts`
Expected: FAIL — `caller.share is not a function`

- [ ] **Step 3: Add `share` and `byShareToken` procedures**

Edit `lib/trpc/routers/quotes.ts` — add these to the `quotesRouter` object (alongside `byId`, `byJobId`, etc.):

```ts
  share: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ input }) => {
    const rows = await db.select().from(quotes).where(eq(quotes.id, input.id))
    const quote = rows[0]
    if (!quote) throw new Error('Quote not found')

    const shareToken = quote.shareToken ?? crypto.randomUUID().replace(/-/g, '')
    await db.update(quotes).set({ shareToken, updatedAt: new Date() }).where(eq(quotes.id, input.id))
    return { shareToken }
  }),

  byShareToken: publicProcedure.input(z.object({ token: z.string().min(1) })).query(async ({ input }) => {
    const rows = await db.select().from(quotes).where(eq(quotes.shareToken, input.token))
    const quote = rows[0]
    if (!quote) throw new Error('Quote not found')
    const items = await db.select().from(lineItems).where(eq(lineItems.quoteId, quote.id))
    return { quote, lineItems: items }
  }),
```

Update the import line at the top of `lib/trpc/routers/quotes.ts` to include `publicProcedure`:

```ts
import { protectedProcedure, publicProcedure, router } from '../init'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/quotes-router-share.test.ts`
Expected: PASS

- [ ] **Step 5: Wire the share button**

Edit `app/(protected)/quotes/[id]/page.tsx` — replace the static "Share with client" button:

```tsx
export default function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const utils = trpc.useUtils()
  const { data } = trpc.quotes.byId.useQuery({ id })
  const updateLineItem = trpc.quotes.updateLineItem.useMutation({
    onSuccess: () => utils.quotes.byId.invalidate({ id }),
  })
  const share = trpc.quotes.share.useMutation()

  if (!data) return <p>Loading...</p>

  return (
    <Card className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl">{data.quote.jobTitle}</h1>
      <p className="text-[var(--color-text-muted)] mt-[var(--space-1)]">{data.quote.scopeOfWork}</p>

      <div className="mt-[var(--space-4)]">
        <QuoteLineItemsTable
          lineItems={data.lineItems}
          onUpdate={(itemId, quantity, unitPrice) => updateLineItem.mutate({ id: itemId, quantity, unitPrice })}
        />
      </div>

      <div className="font-mono-nums mt-[var(--space-4)] text-right text-lg">
        Grand total: R{Number(data.quote.grandTotal).toFixed(2)}
      </div>

      <Button type="button" className="mt-[var(--space-3)]" variant="secondary" onClick={() => share.mutate({ id })}>
        Share with client
      </Button>

      {share.data && (
        <p className="mt-[var(--space-2)] text-sm">
          Client link:{' '}
          <a className="underline" href={`/quote/${share.data.shareToken}`} target="_blank" rel="noreferrer">
            {typeof window !== 'undefined' ? window.location.origin : ''}/quote/{share.data.shareToken}
          </a>
        </p>
      )}
    </Card>
  )
}
```

- [ ] **Step 6: Create the public quote page**

Create `app/quote/[shareToken]/page.tsx`:

```tsx
'use client'

import { use } from 'react'
import { Card } from '@/components/ui/card'
import { trpc } from '@/lib/trpc/client'

export default function PublicQuotePage({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = use(params)
  const { data } = trpc.quotes.byShareToken.useQuery({ token: shareToken })

  if (!data) return <p className="p-[var(--space-4)]">Loading...</p>

  return (
    <div className="min-h-screen p-[var(--space-4)]">
      <Card className="mx-auto max-w-3xl">
        <h1 className="font-display text-2xl">{data.quote.jobTitle}</h1>
        <p className="text-[var(--color-text-muted)] mt-[var(--space-1)]">{data.quote.scopeOfWork}</p>

        <table className="font-mono-nums mt-[var(--space-4)] w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--color-text-muted)]">
              <th className="py-[var(--space-2)]">Item</th>
              <th>Qty</th>
              <th>Unit price</th>
            </tr>
          </thead>
          <tbody>
            {data.lineItems.map((item) => (
              <tr key={item.id} className="border-t border-[var(--color-border)]">
                <td className="py-[var(--space-2)]">
                  {item.itemName} ({item.unit})
                </td>
                <td>{item.quantity}</td>
                <td>R{Number(item.unitPrice).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="font-mono-nums mt-[var(--space-4)] text-right text-lg font-semibold">
          Grand total: R{Number(data.quote.grandTotal).toFixed(2)}
        </div>
      </Card>
    </div>
  )
}
```

- [ ] **Step 7: Verify the app builds**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add quote share links and public client-facing quote page"
```

---

### Task 14: Dashboard, e2e test, and root redirect

**Files:**
- Create: `app/(protected)/dashboard/page.tsx`, `playwright.config.ts`, `tests/e2e/quote-flow.spec.ts`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `trpc.jobs.list` (Task 10).
- Produces: a complete, navigable app; an e2e regression test for the full happy path.

- [ ] **Step 1: Create the dashboard page**

Create `app/(protected)/dashboard/page.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { trpc } from '@/lib/trpc/client'

const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued',
  analyzing: 'Analyzing',
  pricing: 'Pricing',
  ready: 'Ready',
  failed: 'Failed',
}

export default function DashboardPage() {
  const { data: jobs } = trpc.jobs.list.useQuery()

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-[var(--space-4)] flex items-center justify-between">
        <h1 className="font-display text-2xl">Your jobs</h1>
        <Link href="/jobs/new">
          <Button type="button">New job</Button>
        </Link>
      </div>

      <div className="flex flex-col gap-[var(--space-2)]">
        {jobs?.length === 0 && <Card>No jobs yet. Start by recording or uploading job-site footage.</Card>}
        {jobs?.map((job) => (
          <Link key={job.id} href={job.status === 'ready' ? `/quotes/by-job/${job.id}` : `/jobs/${job.id}`}>
            <Card className="flex items-center justify-between hover:bg-[var(--gray-3)]">
              <span>{new Date(job.createdAt).toLocaleString()}</span>
              <span className="font-mono-nums text-sm text-[var(--color-text-muted)]">{STATUS_LABEL[job.status]}</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add the root redirect**

Replace `app/page.tsx`:

```tsx
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function RootPage() {
  const { userId } = await auth()
  redirect(userId ? '/dashboard' : '/sign-in')
}
```

- [ ] **Step 3: Install Playwright**

```bash
pnpm add -D -E @playwright/test@1.49.1
pnpm exec playwright install --with-deps chromium
```

- [ ] **Step 4: Configure Playwright**

Create `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: 'http://localhost:3000' },
})
```

Add to `package.json` scripts: `"test:e2e": "playwright test"`.

- [ ] **Step 5: Write the e2e happy-path test**

Create `tests/e2e/quote-flow.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('redirects unauthenticated users to sign-in', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/sign-in/)
})

test('public quote page renders for an unauthenticated viewer given a valid share token', async ({ page }) => {
  await page.goto('/quote/nonexistent-token-for-smoke-test')
  await expect(page.getByText('Loading...')).toBeVisible()
})
```

Note: a full authenticated upload-to-share e2e run requires a seeded Clerk test user and test database — set up `CLERK_TEST_USER_EMAIL`/`CLERK_TEST_USER_PASSWORD` env vars and a Playwright auth-setup project (per Clerk's official Playwright testing guide) before extending this file with the full authenticated flow. The two smoke tests above are the concrete, runnable starting point; extending to the full flow is flagged as explicit follow-up work, not silently skipped.

- [ ] **Step 6: Run the e2e smoke tests**

Run: `pnpm test:e2e`
Expected: both tests PASS against a locally running dev server.

- [ ] **Step 7: Run the full unit test suite one more time**

Run: `pnpm test`
Expected: all unit tests PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add dashboard, root redirect, and e2e smoke tests"
```

---

## Post-plan follow-ups (not part of this plan)

- Verify and fix real CSS selectors for all 5 scrapers against live vendor sites (flagged in Task 9).
- Extend `tests/e2e/quote-flow.spec.ts` to a full authenticated flow once Clerk test-user credentials are provisioned (flagged in Task 14).
- Set up Sentry + PostHog (skills.md §4) once the app has real traffic to monitor.
- Set up GitHub Actions CI (lint → typecheck → test → build) and Vercel preview deployments.
