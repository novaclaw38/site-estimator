SITE-ESTIMATOR
==============

A Next.js web application for estimating construction or site jobs. (The existing
README.md is the unmodified create-next-app template, so this summary is based on the
project's dependencies and layout.)

TECH STACK
----------
Next.js 15 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, tRPC with
TanStack Query, Drizzle ORM on Neon Postgres, Clerk authentication, AWS S3 uploads with
presigned URLs, Google Generative AI (Gemini), cheerio for HTML scraping, Zod,
Biome (lint/format), Vitest and Playwright.

PROJECT LAYOUT
--------------
  app/          Routes and pages
  components/   UI components
  lib/          Shared code (database, API clients, helpers)
  drizzle/      Generated database migrations
  docs/         Documentation
  tests/        Unit tests (Vitest); end-to-end tests via Playwright
  skills.md     Agent skills notes

GETTING STARTED
---------------
  pnpm install            (or npm install)
  cp .env.example .env.local     (Clerk, database, S3 and Gemini credentials)
  npm run db:generate && npm run db:migrate
  npm run dev             (http://localhost:3000)

SCRIPTS
-------
  dev, build, start, lint (biome check), format, test, test:e2e, db:generate, db:migrate
