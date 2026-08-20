# skills.md — Stack & Craft Briefing for Building a Visually Exceptional Full-Stack App

A senior-architect briefing for Claude Code to execute against. Compiled from four parallel research passes (frontend/UI, backend/infra, design craft, community sentiment) — every claim below traces to a cited source found via live search. Where confidence is lower (content-farm sources, unsettled migrations), that's flagged explicitly rather than presented as consensus.

**Read order for execution**: §3 (Design & Visuals) sets the *why* before any code is written. §1/§2 are the *what*. §4 is what keeps it shippable. §5 is the explicit avoid-list — read it before scaffolding anything.

---

## 1. Frontend Stack

### Meta-framework: Next.js (App Router) — default; watch TanStack Start
Next.js App Router (RSC + Server Actions) remains the safest default for an app-like, stateful product — broadest ecosystem, and virtually every component library discussed below (shadcn, Radix wrappers) assumes it. [Procedure Blog](https://procedure.tech/blogs/nextjs-vs-react-router-v7-vs-astro/)

**Real, current friction** (not hypothetical): dev-server memory leaks requiring restarts, dynamic-route loads reported ~4x slower than the old Pages Router, and growing Vercel lock-in concern. [LogRocket](https://blog.logrocket.com/is-next-js-still-developer-friendly/), [PropelAuth](https://www.propelauth.com/post/nextjs-challenges)

**Emerging, unsettled alternative — TanStack Start** (v1 RC Sept 2025): a wave of "Why I Left Next.js" posts (Jan 2026) cite concrete migration wins — one project's local route loads went 10-12s → ~2s, 30-35% smaller client bundles, builds from 10+ min to under 2. [HN discussion](https://news.ycombinator.com/item?id=47217978), [byteiota](https://byteiota.com/tanstack-start-react-framework-developers-switch-from-next-js/). **Flag**: this is early-stage, not consensus — TanStack Start's auth/deployment ecosystem maturity wasn't independently verified against Next.js. Default to Next.js; don't dismiss TanStack Start as a serious alternative for a greenfield build where RSC lock-in is the concern.

**Alternatives by use case**: React Router v7 (Remix) when hosting independence is a hard requirement — deploys identically to any host with no "works best on Vercel" asterisk. [Procedure Blog](https://procedure.tech/blogs/nextjs-vs-react-router-v7-vs-astro/) Astro for a content/marketing shell in front of the app (near-zero client JS by default) — wrong tool for the app itself. [bejamas](https://bejamas.com/insights/platform-choice/next-js-remix-and-astro-which-is-right-for-your-business)

### Styling: Tailwind CSS v4
CSS-first config, OKLCH color space natively, Oxide engine (~100x faster builds than v3). Weekly downloads ~12M (2026, up from 6M in 2023). **The deciding factor is ecosystem gravity, not just technical merit**: v0, Cursor, Lovable, Bolt, and Claude Code all default to Tailwind — it's now self-reinforcing. [PkgPulse](https://www.pkgpulse.com/guides/stylex-vs-tailwind-2026)

- **AVOID: styled-components** for new projects — entered maintenance mode March 2025, maintainer explicitly said "I would not recommend adopting styled-components" for new work; incompatible with RSC without `'use client'` boundaries everywhere. [GitHub Discussion #5568](https://github.com/orgs/styled-components/discussions/5568)
- **Panda CSS** is the alternative if the team wants type-safe tokens + variant "recipes" and is willing to leave shadcn's gravitational pull; adoption +150% (2024→2026). [PkgPulse](https://www.pkgpulse.com/guides/panda-css-vs-tailwind-2026)
- **vanilla-extract**: not dead, but plateaued (~450K weekly) — Tailwind ate its market. Weak new-adoption case.
- Integration: drive Tailwind's `@theme` from CSS custom properties (semantic tokens, see §3.1) rather than hardcoding Tailwind's default palette — this is the mechanism that keeps a Tailwind app from looking like every other Tailwind app.

### Headless component primitives: Radix UI (via shadcn) — default; watch Base UI
Radix is the incumbent, maintained by WorkOS, literal foundation of shadcn/ui. [ShadcnDeck](https://www.shadcndeck.com/blog/radix-vs-base-ui)

- **Base UI** (built by the same engineers who built Radix, Floating UI, and MUI) reached stable **v1.0 in 2026**, with built-in RTL support Radix lacks — the likely Radix successor over 1-2 years. Choose now only if the team tolerates a still-maturing library.
- **React Aria** (Adobe) — escalate to this only when accessibility is a hard contractual requirement (WCAG AA/AAA, i18n-heavy); more code per component, deepest a11y guarantee available. [LogRocket](https://blog.logrocket.com/headless-ui-alternatives/)

### Component strategy: shadcn/ui — copy-paste, not a dependency
Named 2024's most-starred JS project by net-new GitHub stars. The model: components are copied as source files into your repo, not installed as a versioned package — no theming-API fights, no waiting on a maintainer. [ShadcnDeck](https://www.shadcndeck.com/blog/rise-of-shadcn-ui-2026)

**Why this specifically matters for an AI-driven build** (RedMonk, independent analyst firm): there's no abstraction layer blocking an agent from directly reading/editing real component source. Supabase deprecated its own component library for the same reason — Ivan Vasilov: owning UI code created "an endless wishlist for customizing... and a maintenance burden." [RedMonk](https://redmonk.com/kholterhoff/2025/04/22/ui-component-libraries-shadcn-ui-and-the-revenge-of-copypasta/)

**The trap**: v0, Lovable, Bolt, Cursor, and Claude Code *all* default to unmodified shadcn — meaning raw shadcn defaults (default radius, default shadow scale, default Inter) are becoming their own recognizable "AI app" tell. [Vibe Coder Blog](https://blog.vibecoder.me/shadcn-ui-component-library-ai-development) **The fix is never "use shadcn," it's "use shadcn as raw material"** — change tokens, radii, shadows, motion, and type scale at the source, which is trivial precisely because you own the file. An open-source tool called **Hallmark** runs "57 slop-test gates" specifically to block the Inter+indigo-gradient+rounded-card default before code ships — a sign this is now a formalized problem, not just vibes. [DEV Community](https://dev.to/rams901/hallmark-stop-ai-generated-ui-slop-in-one-command-in-2026-3p9n)

Layer libraries for specific showpiece needs, not whole-app UI: **Magic UI** (150+ animated components, dark-mode/marketing pages — but note this aesthetic is itself becoming recognizable if used unmodified), **Aceternity UI** (bolder — 3D cards, glowing beams, best for hero sections specifically), **Origin UI / Cult UI / Skiper UI** (deeper, less-recognized patterns — Skiper UI explicitly targets what's absent from the shadcn/Magic UI/Aceternity trio). [PkgPulse](https://www.pkgpulse.com/guides/aceternity-ui-vs-magic-ui-vs-shadcn-animated-react-2026)

### Animation: Motion for app UI, GSAP for brand/scroll experiences
**Motion** (renamed from Framer Motion, Feb 2025; `motion/react` import, `framer-motion` package still works) — owns React-native layout animation, `AnimatePresence`, gesture interactions. [Annnimate](https://annnimate.com/compare/gsap-vs-motion)

**GSAP** — owns scroll orchestration and complex timeline choreography; `ScrollTrigger` has 8 years of production hardening on pinning/scrub/parallax that Motion's `useScroll` doesn't match for complex cases. **April 2025: Webflow made all of GSAP free**, including previously-paid plugins (SplitText, MorphSVG, ScrollSmoother) — the historical licensing objection is gone. [Annnimate](https://annnimate.com/compare/gsap-vs-framer-motion), [hontran.dev](https://www.hontran.dev/blog/gsap-vs-framer-motion)

**Rule of thumb** (consistent across sources): GSAP when motion *is* the product identity (Awwwards-tier brand sites, scroll-driven editorial); Motion for SaaS/dashboard/app-level micro-interactions where animation supports UX rather than defines it.

Supporting cast: **Lenis** (darkroom.engineering, 3KB lerp-based smooth scroll — standard GSAP ScrollTrigger pairing) [GitHub](https://github.com/darkroomengineering/lenis); **Lottie/dotLottie** for onboarding/loading illustration (dotLottie cuts file size up to 80%); **Rive** for interactive state-machine-driven icons/characters needing runtime logic, not just playback.

### 3D/WebGL — only when 3D is core to brand identity
WebGPU hit ~95% global browser coverage by 2026. Three.js r182 (Dec 2025) promoted `WebGPURenderer` to recommended, with R3F support via an async `gl` prop factory. Best practice: ship WebGPU with WebGL fallback, not WebGPU-only. [youngju.dev](https://www.youngju.dev/blog/culture/2026-05-16-webgpu-webgl-2026-three-js-r3f-babylon-playcanvas-tres-needle-native-webgpu-wgsl-deep-dive.en)

React Three Fiber for 3D embedded in a React app; drop to vanilla Three.js for the most bespoke Awwwards-grade control. [pkgpulse](https://www.pkgpulse.com/guides/threejs-vs-react-three-fiber-vs-babylonjs-3d-webgl-2026) **Spline** as the designer-facing no-code bridge, now with experimental export to R3F code. [svilenkovic.com](https://svilenkovic.com/3d/three-js-vs-spline) This is a 60+ hour learning-curve and real bundle/perf cost — don't default to it for standard app UI.

### State management: layer by concern, don't pick one tool for everything
2026 consensus splits server state from client state as different problems entirely:
- **TanStack Query** for server state — "always, no exceptions" per community consensus, not really debated anymore.
- **Zustand** (1.1KB) as default global client state — has overtaken Redux in raw downloads.
- **Jotai** for complex interdependent/derived state (form builders, spreadsheets) — typically used *alongside* Zustand, not instead of it.
- **Redux Toolkit** — reserved for large-team enterprise state needing strict patterns and time-travel debugging; a deliberate escalation, not a default anymore.

Recommended layered stack: **TanStack Query (server) + Zustand (client) + Jotai (forms/derived)**. [saschb2b](https://saschb2b.com/blog/react-state-management-2026), [vucense](https://vucense.com/dev-corner/react-state-management-2026/)

### Icons & fonts
**Lucide** — ~16x Phosphor's usage, shadcn-ecosystem default, single refined outline style, 1,600+ icons, tree-shakeable across frameworks. **Phosphor** — 7,700+ icons across 6 weights (thin→fill/duotone), the right choice when weight variation is a deliberate design lever rather than one flat style. [wmtips](https://www.wmtips.com/technologies/compare/lucide-vs-phosphor-icons/), [allsvgicons](https://allsvgicons.com/compare/phosphor-vs-lucide/)

Variable fonts are baseline, not optional. **Self-host** fonts sourced from Google Fonts/Fontshare as the 2026 default (GDPR, perf, no third-party request). **Fontshare** has a much smaller library (~100 vs Google's 1,500+ families) but a materially higher average design-quality bar — worth it specifically when the brief calls for distinctive, non-default typography. [madegooddesigns](https://madegooddesigns.com/fontshare/), [muz.li](https://muz.li/blog/best-free-variable-fonts-for-ui-and-web-design-2026/)

---

## 2. Backend / Full-Stack Stack

### Runtime: Node.js default, Bun for greenfield perf-sensitive services
Bun (v1.3.14, ~98% Node API compat) is now credible in production — **Anthropic acquired Bun in Oct 2025**; Claude Code, Railway Functions, Midjourney, and X run on it. [daily.dev](https://daily.dev/blog/javascript-runtimes-bun-vs-node-js-vs-deno-comparison/), [buildmvpfast.com](https://www.buildmvpfast.com/blog/bun-vs-node-production-saas-backend-2026)

**Performance claims are real but overstated for typical apps**: synthetic benchmarks show Bun ~4x Node, but a real-world test with routing/validation/DB calls found them within 3% of each other — the database is the bottleneck, not the runtime, once real I/O is involved. A cited migration (Node 20 → Bun 1.2) cut p50 latency 42ms→28ms — real but narrow. [buildmvpfast.com](https://www.buildmvpfast.com/blog/bun-vs-node-production-saas-backend-2026)

Node still dominates enterprise (42.65% pro adoption, 85% of enterprise traffic); compliance-heavy orgs can't yet adopt Bun as the prod runtime due to native-crypto-module compliance gaps, though they use its faster install/test/bundle tooling regardless. [ecorpit.com](https://ecorpit.com/bun-vs-nodejs-2026-backend-runtime-decision/) **Recommendation**: Node LTS as the safe default for anything payments/compliance-adjacent; Bun is legitimate for new greenfield API/edge services and its built-in test runner + bundler + package manager reduce tooling sprawl regardless of choice.

### API layer: Server Actions or tRPC — internal; REST/GraphQL — external
tRPC v11 (late 2025) added RSC support and streaming — you can call tRPC procedures directly from server components with full type safety. [Medium](https://medium.com/@factman60/next-js-server-actions-vs-trpc-a-2026-architects-guide-85cc4953bae4)

- **Server Actions win** for form-heavy, content-focused apps — best DX/velocity, progressive enhancement.
- **tRPC wins** for complex data-intensive dashboards, or apps serving multiple clients (web + mobile) needing a stable typed procedure surface. "Eliminates the API boundary entirely — procedures are just TypeScript functions." [apiscout.dev](https://apiscout.dev/guides/trpc-vs-graphql-vs-rest-2026)
- **GraphQL is declining in this segment**: full-stack JS job listings mentioning it dropped ~40%→~25% (early 2025 → Feb 2026) as tRPC/Server Actions absorb the typesafe-internal-API use case. Still correct for genuinely heterogeneous multi-client/public APIs. REST remains in ~70% of listings — it's the interop/public-API layer, not going anywhere.
- **Guidance**: internal monorepo calls → tRPC or Server Actions; public/partner API → REST (OpenAPI) or GraphQL only with a real multi-client need. Don't add GraphQL for "flexibility" alone.

### ORM: Prisma (default) vs Drizzle (edge/serverless)
**Drizzle**: 25,000+ stars, default recommendation in Hono.js docs, Astro DB built on it. SQL-like query builder, no separate query-engine binary, smaller bundles, faster cold starts — the deciding factor for Cloudflare Workers/Vercel Edge deploys. [bytebase.com](https://www.bytebase.com/blog/drizzle-vs-prisma/)

**Prisma**: officially favored in SvelteKit/Remix docs, stronger for teams wanting an ORM mental model over raw SQL, better migrations UX/Studio tooling. "Most teams should still default to Prisma because developer productivity matters more than raw performance for most applications" — but Drizzle wins decisively if the target deploy is edge/serverless-first. [encore.dev](https://encore.dev/articles/drizzle-vs-prisma)

Integration: Drizzle pairs with `drizzle-zod`, Prisma with `zod-prisma-types` — either integrates cleanly with tRPC input validation (see Zod, below).

### Database: Postgres by default; pick provider by workload shape
- **Supabase** — broadest bundle (Postgres + Auth + Storage + Edge Functions + Realtime + pgvector), one vendor for DB+auth+storage.
- **Neon** — cleanest serverless Postgres primitive: scale-to-zero, copy-on-write branching (ideal for preview-env/CI workflows). **Acquired by Databricks May 2025**, cutting pricing 15-25% and adding SOC2/HIPAA eligibility on Scale plan. [apiscout.dev](https://apiscout.dev/guides/supabase-vs-neon-planetscale-serverless-db-2026)
- **PlanetScale** (MySQL/Vitess) — **dropped foreign-key constraint support Apr 2026** (their argument: FKs don't fit distributed sharding). Real gotcha for teams assuming standard relational integrity — only choose deliberately for Vitess sharding needs. [techsy.io](https://techsy.io/en/blog/neon-vs-planetscale-vs-turso)
- **Turso** (libSQL/SQLite fork) — edge-replicated, single-digit-ms global reads; not Postgres, use for read-heavy geo-distributed or embedded/local-first cases, not general relational backend.
- **Redis/Upstash** — caching, rate limiting, sessions, job queues; Upstash's HTTP-based, pay-per-request model fits edge/serverless apps that don't want to manage infra. [dragonflydb.io](https://www.dragonflydb.io/guides/upstash-solution-overview-pros-cons-and-alternatives)
- **pgvector wins by default for embeddings** — under 5M vectors it's latency-comparable to Pinecone, keeps vectors in the same DB/transaction as relational data (one source of truth, no sync jobs), and is dramatically cheaper (~$835/mo self-hosted Postgres vs Pinecone $3,241-3,889/mo at 50M vectors per a Timescale benchmark). Only reach for Pinecone/Qdrant/Weaviate at hundreds of millions–billions of vectors. [encore.dev](https://encore.dev/articles/pgvector-vs-pinecone)

### Auth: Clerk (managed) or Better Auth (self-hosted) — not Lucia, not fresh Auth.js
**Lucia is deprecated** (effective Mar 2025, site updated Jul 2026) — pivoted from an npm dependency to a "copy this code" learning resource. **Do not start new projects on it.** [lucia-auth.com](https://lucia-auth.com/), [wisp.blog](https://www.wisp.blog/blog/lucia-auth-is-dead-whats-next-for-auth)

**Better Auth** is the recommended Lucia successor and "the best default for new self-hosted TypeScript apps" per multiple 2026 comparisons. [makerkit.dev](https://makerkit.dev/blog/tutorials/better-auth-vs-clerk) **Auth.js/NextAuth** merged efforts with Better Auth late 2025 — still fine for established codebases already on it, framed by multiple sources as "the thing you migrate away from, not toward" for new work. [blog.codercops.com](https://blog.codercops.com/blog/nextjs-auth-comparison-clerk-better-auth-2026)

**Clerk** — managed/hosted, pre-built themeable UI (sign-in, user profile, org switcher), TS-first types. Valuable specifically for a "visually exceptional" app since it ships polished components that would otherwise be significant custom UI work. [clerk.com](https://clerk.com/articles/clerk-vs-auth0-for-nextjs) **WorkOS** for B2B enterprise SSO/SAML/SCIM, commonly layered alongside Clerk when B2B customers demand it. Supabase Auth is the right default if already on Supabase for the DB.

### File storage: Cloudflare R2 (cost) + Uploadthing (upload UX)
**R2** — S3-compatible, zero egress fees, $0.015/GB — cheapest at scale for media-heavy apps. [inventivehq.com](https://inventivehq.com/blog/cloudflare-r2-vs-aws-s3-vs-azure-blob-vs-google-cloud-storage-comparison) **Vercel Blob** — tightest DX if fully committed to Vercel, but not S3-compatible (lock-in cost to weigh). **Uploadthing** — TS-native upload flow with flat $10-25/mo pricing, solves presigned-URL plumbing fast. [apiscout.dev](https://apiscout.dev/guides/uploadthing-vs-cloudflare-r2-vs-s3-nextjs-2026)

### Deployment: split by workload, avoid single-vendor lock
Vercel (frontend/Next.js specifically) + Railway or Fly.io (backend services/workers/queues) + R2/Neon/Supabase (data). Railway wins DX for solo/small teams ($10-15/mo typical); Render for flat/predictable pricing; Fly.io for global-edge control with 18 regions at sub-20ms. [devtoolpicks.com](https://devtoolpicks.com/blog/railway-vs-render-vs-fly-io-solo-developers-2026), [techsy.io](https://techsy.io/en/blog/railway-vs-render-vs-fly-io)

**AVOID: Heroku for new work** — officially moved to "sustaining engineering" (maintenance mode) Feb 2026, no new features, degrading add-on ecosystem. [devops-daily.com](https://devops-daily.com/posts/heroku-alternatives-2026)

### Monorepo: pnpm workspaces → Turborepo → Nx only if it hurts
Turborepo: fast task caching, seamless remote caching on Vercel, works with existing `package.json` scripts — right for most apps sharing types/UI between a Next.js app and a handful of packages. Nx: justified only with multiple teams/app-types and CI cost high enough that affected-graph awareness pays for itself. **Don't start a solo/small-team app with Nx's ceremony.** [digitalapplied.com](https://www.digitalapplied.com/blog/monorepo-strategy-2026-turborepo-nx-decision-matrix)

### Validation: Zod v4 — required infrastructure, not a choice
7-14x faster parsing, 57% smaller bundle vs v3; Zod Mini ~10KB min+gz. Implements **Standard Schema**, a shared interface also used by Valibot/ArkType — tRPC v11 and TanStack Form validate against any Standard-Schema library without a Zod-specific adapter. [speakeasy.com](https://www.speakeasy.com/blog/release-zod-v4), [zod.dev](https://zod.dev/v4) **Pattern**: define schemas once in a shared `packages/schemas`, reuse for tRPC/Server Action input, react-hook-form resolvers, and drizzle-zod/zod-prisma-types DB-layer parity — one source of truth for shape across the whole stack.

### Recommended default backend stack (synthesized)
Next.js (App Router, Server Actions for forms) + tRPC v11 (complex dashboard/API surface) + Drizzle or Prisma (Drizzle if edge-deployed) + Postgres via Neon (branching/preview envs) or Supabase (bundled auth/storage) + Zod v4 shared validation + Better Auth or Clerk + Cloudflare R2 + Vercel (frontend) / Railway or Fly.io (backend) + Turborepo + pnpm workspaces.

> **Confidence note from the backend research pass**: several sources above (apiscout.dev, pkgpulse.com, techsy.io, devtoolpicks.com, buildmvpfast.com) are comparison-farm content rather than primary vendor/engineering blogs. The directional consensus is credible — consistent across many independent write-ups — but verify hard numbers (benchmarks, pricing) against primary docs before treating them as load-bearing facts in a deliverable.

---

## 3. Design & Visuals — the Craft Layer

### 3.1 Design token architecture: primitive → semantic → component
Primitive tokens are raw values with no meaning (`color.blue.500 = #3B82F6`). Semantic tokens describe intent by referencing primitives (`color.action.primary = {color.blue.500}`, `color.surface.default = {color.gray.100}`). Component tokens are scoped to one component and reference semantic tokens. [Contentful](https://www.contentful.com/blog/design-token-system/)

**Radix Colors** implements this concretely: 25 accent + 5 gray scales, each with 12 numbered steps engineered for specific *uses* — steps 1-2 backgrounds, 3-5 component bg/hover/active, 6-8 borders, 9-10 solid fills, 11-12 text — not arbitrary lightness steps. [DeepWiki](https://deepwiki.com/radix-ui/themes/3.1-color-system-and-design-tokens) **Open Props** is the framework-agnostic primitive layer (pure CSS custom properties) that plugs into vanilla CSS, Tailwind v4's CSS-based config, or any architecture. [nerdy.dev](https://nerdy.dev/BYO-CSS-tokens-to-tailwind-v4s-new-CSS-centric-config)

**Rule**: never let component code reference a primitive directly (`bg-blue-500` in a button is a smell). Route everything through the semantic layer — this is what makes a rebrand or dark-mode pass a token-file edit instead of a codebase-wide find/replace, and it's the direct mechanism dark mode should be built on (a second value-set behind the same semantic names).

### 3.2 Typography
**Modular scale**: base size × fixed ratio generates the full type scale — Minor Third (1.2) for subtle text-heavy UI, Major Third (1.25) as a versatile default, Golden Ratio (1.618) for high-impact/editorial. The value is that every size relates predictably to every other, unlike arbitrary sizing. [spec.fm](https://spec.fm/specifics/type-scale)

**Variable fonts**: one file replaces per-weight downloads (perf win), and the weight axis (`wght`) lets a heading sit at 523 or 680 instead of being locked to 400/700 — enabling fluid typography where weight/width respond to viewport. [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Fonts/Variable_fonts)

**Named custom fonts as a craft signal**: Vercel commissioned **Geist** (with Basement Studio, 2023) specifically because a bespoke Swiss-influenced sans + matching monospace was a differentiator — "precision, clarity, functionality" as the explicit brief — rather than shipping a system font. [Basement Studio](https://basement.studio/post/the-birth-of-geist-a-typeface-crafted-for-the-web) This is the pattern to copy: treat "which typeface" as a brand decision, not a defaults question. Pair a display face (character at large sizes), a body face (legibility at reading sizes), and a deliberate monospace for code/numbers/metadata — tabular figures + a mono face are specifically what make numeric-heavy UI (dashboards, pricing) read as engineered rather than generic.

### 3.3 Color strategy
**One accent + mostly neutral**: distributional convergence in AI training data means the "statistical center" of nice-modern-UI defaults to blue-to-purple gradients — traceable in part to Tailwind UI's default `bg-indigo-500`, which Adam Wathan has publicly said he regrets. [superdesign.dev](https://superdesign.dev/blog/why-ai-design-looks-generic), [prg.sh](https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website) The named fix: an explicit **prohibition list** (no purple/blue gradient, no default Inter, no centered-hero-with-three-cards) rather than trusting "make it look modern" to avoid the statistical mean. Target ~90% neutral surfaces with one accent reserved for a small number of high-signal placements (primary CTA, active nav, focus ring).

**OKLCH over HSL/RGB**: HSL's lightness channel isn't perceptually accurate across hues (50% lightness yellow reads far brighter than 50% lightness blue), breaking any attempt to generate a consistent palette or guarantee contrast via lightness alone. OKLCH gives perceptual uniformity — equal numeric deltas produce equal perceived deltas regardless of hue — natively supported in CSS since 2023. [Evil Martians](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl)

**APCA vs WCAG 2 contrast**: WCAG 2.x is a static luminance ratio that ignores font weight/size and overstates contrast in dark colors. APCA is perceptually calibrated, accounts for weight/size, and is the WCAG 3 candidate method (pulled from the draft in 2023 pending further work) — treat APCA as the more rigorous check today, WCAG 2 as the current compliance baseline. [apcacontrast.com](https://git.apcacontrast.com/documentation/WhyAPCA.html)

### 3.4 Spacing & grid
4px/8px base grid for all spacing (margin, padding, gap, icon size, line-height) — 8 is cleanly divisible, aligns across device pixel ratios, and is why Apple HIG and Material Design both standardize on it. Use 4px for tighter/dense contexts (icon padding, dense tables), 8px for macro layout. [blog.prototypr.io](https://blog.prototypr.io/the-8pt-grid-consistent-spacing-in-ui-design-with-sketch-577e4f0fd520) The real payoff isn't the math — it removes an entire category of bikeshedding ("13px or 15px?") and makes handoff exact. Dashboards compress toward 4px + tabular numerals; marketing/landing surfaces lean generous 8px-multiples — whitespace as a deliberate signal of considered design (the Linear/Vercel/Stripe minimalism pattern).

### 3.5 Motion principles (the *why*, not the library)
Per Emil Kowalski (animations.dev):
- **Ease-out for UI state changes** (fast start, slow finish) — reads as responsive because motion is most visible right when triggered. Never ease-in for UI.
- Built-in CSS easings are too weak — use strong custom cubic-beziers, e.g. `cubic-bezier(0.23, 1, 0.32, 1)` for state changes, `cubic-bezier(0.32, 0.72, 0, 1)` for gesture/drawer interactions.
- Stay **under 300ms** unless a large element traveling a long distance specifically justifies more. [emilkowal.ski](https://emilkowal.ski/ui/great-animations)

**Motion should explain a state change, not decorate** — an element entering shows where it came from, leaving shows where it's going, loading shows progress structure. Bouncing logos and gratuitous parallax have no informational payload — that's the "decorative" category to avoid.

**Rauno Freiberg** (Vercel staff design engineer) catalogs the unglamorous details that separate "fine" from category-leading: hover/focus/active/disabled/loading/empty **microstates** as first-class design surfaces, touch-target overflow, optical spacing, motion staggers for lists. [interfaces repo](https://github.com/raunofreiberg/interfaces)

**Reduced motion is required, not optional**: gate CSS transitions/keyframes behind `prefers-reduced-motion: reduce` directly; centralize the check for JS-driven animation (a `usePrefersReducedMotion` hook). Design an alternative *non-motion* affordance (fade instead of slide) rather than just deleting the animation. [Josh Comeau](https://www.joshwcomeau.com/react/prefers-reduced-motion/)

### 3.6 What makes an app look "AI-generated" — named anti-patterns
- **The purple/blue gradient hero + Inter + three rounded cards** — the literal statistical center of "nice modern web UI" in training data. [superdesign.dev](https://superdesign.dev/blog/why-ai-design-looks-generic)
- **Mechanism**: "distributional convergence" — safe, universally-inoffensive choices dominate training data, so an unconstrained model regresses to the mean every time.
- **The fix**: an explicit prohibition list at the top of a design brief does more work than positive instructions ("make it modern" still resolves to the mean). Also: broken heading hierarchy, missing OG tags/alt text/viewport meta, stale favicons — a documented analysis of 100 AI-generated sites found aesthetics were usually fine but these technical foundations were consistently neglected. [dev.to](https://dev.to/kaplich/i-analyzed-100-vibe-coded-websites-and-found-these-common-mistakes-5275) **Actionable**: a pre-ship checklist covering OG tags, alt text, heading hierarchy, viewport meta, favicon, and meta description directly addresses this documented failure pattern.

### 3.7 Component/layout craft details
- **Microstates as a checklist**: every interactive element needs considered hover, focus, active, disabled, loading, and empty states — not just a default and a `:hover` color swap.
- **`focus-visible` over `:focus`**: keyboard-focus styling separated from mouse-click focus so sighted mouse users don't see a ring on click while keyboard users get a clear indicator.
- **Skeleton screens over spinners for content loads**: reveals structure so the brain anticipates what's coming; skeleton loads are perceived ~30% faster than identical-duration spinner loads. Rule of thumb: spinners for short (<2s) system operations, skeletons for content-heavy screens (feeds, profiles, lists). [LogRocket](https://blog.logrocket.com/ux-design/skeleton-loading-screen-design/)
- **Empty states as designed surfaces**: explain why it's empty, offer the next action — a direct extension of "motion explains state change" applied to zero-data states.
- **Linear's quality bar**: a designer embedded on every user-facing feature team from spec-writing onward — craft is a process commitment, not a late polish pass. [Figma blog: Karri Saarinen's 10 Rules](https://www.figma.com/blog/karri-saarinens-10-rules-for-crafting-products-that-stand-out/)

---

## 4. DevOps / Tooling

### Testing: Vitest (new Vite projects), Playwright (e2e default)
**Vitest** is the default for Vite-powered projects — native ESM (Jest 30 stays CJS-first, ESM still second-class behind flags), 2-10x faster cold starts cited in benchmarks. **Stay on Jest for existing projects without a concrete pain point** — this is not a rip-and-replace recommendation. [sitepoint.com](https://www.sitepoint.com/vitest-vs-jest-2026-migration-benchmark/)

**Playwright** leads adoption (45.1% vs Cypress 14.4% among QA professionals cited) and is the default recommendation for new e2e work — auto-waiting cuts flaky tests (~60% reduction cited), true parallel execution, full cross-browser including Safari/WebKit (Cypress still lacks complete Safari support). Cypress retains an edge in real-time visual debugging DX; not worth migrating away from if a team is already productive with it. [bugbug.io](https://bugbug.io/blog/test-automation-tools/cypress-vs-playwright/) Testing Library remains the standard pairing for component tests with either runner.

### Linting/formatting: Biome for new projects
Rust-based unified linter+formatter, ~25x faster formatting than Prettier, ~20x faster linting than ESLint — cited enterprise adoption at Vercel and Google. [devtoolbox.blog](https://devtoolbox.blog/biome-vs-eslint-prettier-2026-2/) **New projects**: default to Biome. **Existing projects**: don't migrate without a concrete reason. Common hybrid: Biome for formatting + most linting, thin ESLint config only for plugin-specific rules Biome hasn't reached yet (e.g. `import/no-cycle`).

**TypeScript strict mode** is the settled baseline: `"strict": true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `useUnknownInCatchVariables`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax`; ban `any`, use `satisfies` for config objects, explicit return types on exported functions. [reintech.io](https://reintech.io/blog/how-to-configure-tsconfig-json-best-practices-2026)

### CI/CD: reusable workflows + preview deployments as a design-review tool
GitHub Actions best practice: reusable workflows (`workflow_call`) instead of one giant file, OIDC auth to eliminate long-lived cloud credentials, SHA-pinned action dependencies. Standard pipeline: lint → typecheck → test → build → security scan → deploy. [devtoollab.com](https://devtoollab.com/blog/github-actions-best-practices)

**Preview deployments matter specifically for visual work**: Vercel/Netlify auto-generate a unique URL per PR, with the Vercel bot commenting it (plus Lighthouse scores) directly on the PR. This replaces reading a diff (no visual regression signal), pulling the branch locally (context-switch cost), or a shared staging env ("always broken") with a live, isolated, clickable instance non-engineers can review with zero setup. [Vercel Community](https://community.vercel.com/t/why-developers-prefer-using-preview-deployments-on-vercel/28450) **For a Claude-driven build specifically**: this is the mechanism that lets a human (or a headless browser tool) actually verify the UI looks right in situ, rather than trusting a screenshot or a code read.

### Monitoring: Sentry + PostHog baseline
Sentry (errors) + PostHog (product analytics/session replay, now bundling error tracking too, 100k errors/month free tier) is the cited baseline for a new full-stack app; Datadog is overkill until infra complexity demands it. [toolroute.ai](https://toolroute.ai/blog/sentry-vs-datadog-vs-posthog)

### Package management: pnpm
Content-addressable global store + hard-linking eliminates redundant installs (one benchmark: 610MB vs 1.4GB disk use vs npm), prevents phantom-dependency bugs, strong Turborepo/Nx integration via `--filter`. **Yarn Classic (v1) is explicitly maintenance-mode — don't use for new projects.** npm remains fine if avoiding tooling-compatibility risk is the priority. [dev.to](https://dev.to/jtorchia/pnpm-vs-npm-vs-yarn-in-2026-i-ran-all-three-on-my-real-monorepo-and-it-forced-me-to-change-my-mind-9mc)

### Supply-chain security — flag before greenlighting any dependency tree
This is the single most concrete recent shakeup and should shape dependency hygiene directly:
- **Sept 8, 2025**: largest npm supply-chain attack in registry history — 18 popular packages (`chalk`, `debug`, `ansi-regex`), combined >2B weekly downloads, injected crypto-stealing code.
- **Shai-Hulud worm** (Sept 2025): first self-propagating npm worm — stole GitHub/npm tokens, cloud credentials, then auto-infected further packages.
- **March 31, 2026**: two malicious `axios` versions (~100M weekly downloads) live ~3 hours, attributed to a North Korea-linked group.
- Sonatype's 2026 report: 454,600+ new malicious open-source packages in 2025 alone, cumulative past 1.233M (+75% YoY). [Datadog Security Labs](https://securitylabs.datadoghq.com/articles/npm-worm-compromises-popular-npm-packages/)

**Practical implication**: pin exact versions (avoid `^`/`~` ranges), commit lockfiles, run `npm audit` (or equivalent) as a CI gate, be conservative adding low-utility transitive-heavy packages. Even extremely common packages (`chalk`, `axios`) have been compromised in the past year.

---

## 5. Explicit Avoid List (read before scaffolding)

| Item | Status | Why / Source |
|---|---|---|
| **styled-components** (new projects) | Maintenance mode since Mar 2025 | Maintainer-declared, RSC-incompatible. [GitHub #5568](https://github.com/orgs/styled-components/discussions/5568) |
| **Lucia Auth** | Deprecated since Mar 2025 | Now a code-reference, not a maintained package. Migrate to Better Auth. [lucia-auth.com](https://lucia-auth.com/) |
| **Auth.js/NextAuth** (fresh adoption) | Legacy-framed | Merged into Better Auth org; multiple sources call it "migrate away from, not toward." [blog.codercops.com](https://blog.codercops.com/blog/nextjs-auth-comparison-clerk-better-auth-2026) |
| **Heroku** | Sustaining-engineering mode since Feb 2026 | No new features, degrading add-ons. [devops-daily.com](https://devops-daily.com/posts/heroku-alternatives-2026) |
| **PlanetScale** (as default relational choice) | Real gotcha | Dropped FK constraint support Apr 2026 — only pick deliberately for Vitess sharding. [techsy.io](https://techsy.io/en/blog/neon-vs-planetscale-vs-turso) |
| **Yarn Classic (v1)** | Maintenance mode | Not for new projects; Yarn Berry retains a narrow enterprise niche. |
| **GraphQL** (for internal TS-monorepo APIs) | Declining, not dead | Job-listing share 40%→25% in ~1yr as tRPC/Server Actions absorb the use case. Still right for genuine multi-client/public APIs. |
| **Unmodified shadcn / Magic UI / Aceternity defaults shipped verbatim** | Recognizable "AI app" tell | Same tooling (v0, Cursor, Claude Code) defaults to the same unmodified output — must be restyled at the token level. |
| **Inter + indigo/purple gradient + centered-hero-three-cards** | The literal AI-slop fingerprint | Distributional convergence in training data; Tailwind UI's default `indigo-500` is a named proximate cause (Adam Wathan has publicly regretted it). |
| **vanilla-extract** (new adoption) | Plateaued, not dead | Weak case vs Panda CSS or Tailwind v4 for new projects. |

---

## 6. Synthesized Default Stack

**Frontend**: Next.js App Router + Tailwind v4 (semantic-token-driven `@theme`) + Radix/shadcn (restyled at the source) + Motion (app UI) / GSAP+Lenis (marketing/scroll surfaces) + TanStack Query + Zustand + Jotai (forms) + Zod v4 + Lucide + a deliberately chosen, self-hosted variable font pair (not default Inter).

**Backend**: Node.js LTS (Bun for greenfield perf-sensitive services) + tRPC v11 / Server Actions + Drizzle or Prisma + Postgres via Neon or Supabase + Better Auth or Clerk + Cloudflare R2 + Vercel (frontend) / Railway or Fly.io (backend) + Turborepo + pnpm.

**Craft process**: write the design-token file (primitive → semantic → component, OKLCH-based, APCA-checked) and an explicit prohibition list *before* generating any UI — this is the single highest-leverage move against generic output, per §3.6 and the community-intelligence findings in §4.

**Tooling**: Vitest + Playwright + Testing Library, Biome, TypeScript strict+, GitHub Actions with preview deployments as the design-review loop, Sentry + PostHog, pinned dependencies with `npm audit` as a CI gate.
