# PROJECT_AUDIT.md — Zviko Growth Engine

**Phase:** 0 — Repository & System Audit
**Date:** 2026-09-05
**Repository:** `vtrxapp/ai-sales-agent`
**Branch:** `claude/funny-rubin-krs6p4`

---

## 0. Headline Finding

**The repository is empty.** There is no existing code to audit.

Verified two independent ways:
- Local clone: `git log` → `fatal: your current branch 'claude/funny-rubin-krs6p4' does not have any commits yet`; `git branch -r` returns nothing; `git fetch origin` returns nothing.
- GitHub API (`get_file_contents` on `/`): `409 Git Repository is empty` — GitHub confirms there is no default branch, no refs, no commits at all.

There is no `package.json`, no framework, no database, no auth, no CI, no `.env.example`, no prior README, no tests, and no deployment configuration anywhere in this repository. This is a **greenfield build**, not a migration or refactor of an existing system.

This changes the shape of Phase 0. Sections 1–7 of the standard audit template (current architecture, existing functionality, etc.) are answered "none exist" throughout. The substantive part of this document is therefore the **recommended architecture and phased implementation plan** (§8–9), since there is nothing yet to reuse or replace.

I want to flag this clearly rather than inventing findings: nothing below about "existing" anything is real unless explicitly marked. No code will be written until you approve this audit and the plan in §9.

---

## 1. Current Architecture

None. The repository contains only a `.git` directory with no history.

## 2. Existing Functionality

None.

## 3. Existing Integrations

None. No API keys, SDKs, or service configuration of any kind are present.

## 4. Database Structure

None. No Supabase project reference, no migrations directory, no schema files were found in the repo. (I have not been given a Supabase project to connect to yet — see Open Questions §11.)

## 5. Authentication

None implemented.

## 6. Current Deployment

None. No Vercel project files (`vercel.json`), no CI/CD workflows (`.github/workflows/`), no Dockerfiles.

## 7. Problems Discovered

- The repository has zero commits — nothing to lose, nothing to break, no legacy debt to work around. This is the best-case starting condition for a clean build.
- No `.gitignore` exists yet — needs one before any dependency install (to keep `node_modules`, `.env*`, `.next`, etc. out of history).
- No license/ownership metadata — not blocking, just noting it's absent.

## 8. Security Concerns

None specific to this repo (nothing exists to have a vulnerability). General concerns to design in from day one, since there's no legacy pattern to fight:
- Secrets (Supabase service-role key, AI provider keys, any business-data API keys) must never enter client bundles or get committed — `.env.example` with placeholders only, real values via Vercel project settings or a gitignored local `.env.local`.
- Supabase Row Level Security must be enabled on every table from the first migration — there's no "add it later" excuse on a fresh schema.
- Because this platform's stated purpose includes discovering businesses and (for Product B) audiences of adults, the authorization/consent boundaries in the spec (no scraping private data, no minors, human-approval gate before any outreach send) need to be enforced at the service layer, not just as UI copy. I'll build the approval workflow (Draft → Review → Approve → Execute) as a real state machine with server-side checks, not a client-side toggle.

## 9. What Can Be Reused

Nothing — there is no prior code.

## 10. What Needs to Be Built

Everything described in the master prompt, phased per §38 of your instructions. See the recommended architecture and phase plan below.

---

## 11. Open Questions (need your input before or during Phase 1)

These aren't blockers to writing this audit, but they do affect Phase 1 setup and I'd rather ask than assume:

1. **Supabase project**: Do you already have a Supabase project created (org, project ref, keys), or should Phase 1 include provisioning one? I have a Supabase MCP tool available and can create a project if you want me to drive that.
2. **AI provider**: The spec asks for a provider-agnostic abstraction layer (good — that's the right call regardless). Which provider should be the *first* concrete implementation behind that abstraction — Anthropic (Claude) via API key, or another? Given this is Claude Code, defaulting to Anthropic's API first is the pragmatic choice unless you have a preference.
3. **Deployment target**: Confirm Vercel is the actual target (spec says "Vercel-compatible architecture") and whether you already have a Vercel project/team to link, or if that's set up later.
4. **Auth provider**: Spec says use Supabase Auth "unless there's a compelling reason otherwise." Since there's no existing auth to preserve, I'll default to Supabase Auth (email/password + magic link) for the internal team. Confirm this is just for your internal team (you + collaborators), not public signup — that affects RLS policy design.
5. **Business data / enrichment APIs**: Section 5/9 mention "potential business intelligence/data providers can be integrated later." For Phase 2 (lead discovery), do you have accounts with any specific data provider already (e.g., Clearbit, Apollo, Google Places/Maps for business listings), or should Phase 2 start with manual/CSV-import business entry plus AI-assisted research on URLs you provide, deferring paid enrichment APIs until you choose one?
6. **Domain/branding**: Any existing Figma designs, brand colors, or logo for "Zviko Growth Engine" I should use, or should Phase 1 use a clean professional default (dark sidebar, data-dense dashboard) that we refine later?

I'll proceed with sensible defaults (Supabase Auth, Anthropic as first AI provider, manual/URL-driven research before paid enrichment APIs, clean default design system) unless you tell me otherwise — flagging so you can redirect before Phase 1 starts.

---

## 12. Recommended Architecture

Since there is no existing system to accommodate, I recommend building exactly to the spec's preferred stack (§5), with the following concrete choices:

**Framework**: Next.js 14+ (App Router), TypeScript in strict mode, React Server Components where they reduce client bundle size (dashboard pages, data tables), client components only where interactivity requires it (forms, charts, drag-and-drop pipeline, AI chat).

**Styling/UI**: Tailwind CSS + shadcn/ui (Radix primitives). shadcn's copy-in-repo model fits the "no over-engineering" principle — we only pull the components we use, no opaque UI-library dependency.

**Database**: Supabase Postgres. Schema managed via Supabase migrations (SQL files checked into `supabase/migrations/`), not hand-applied changes — this gives you a reviewable history and repeatable deploys. RLS on every table from migration #1. Every externally-sourced table gets `source`, `source_url`, `discovered_at` per §30.

**Auth**: Supabase Auth, email/password + magic link, single internal `profiles` table keyed to `auth.users`. Since this is an internal tool (not public-facing signup for staff), I'll gate signup — no open registration; users are invited/created directly, or a simple allowlist-by-email-domain check.

**Server-side services**: Next.js Route Handlers (`app/api/**/route.ts`) for anything touching secrets — AI calls, enrichment APIs, email/outreach sending. Business logic lives in a `lib/services/*` layer (the `BusinessResearchService`, `LeadScoringService`, etc. named in §35), called from route handlers — never inline in UI components, never called client-side with a secret key.

**AI abstraction**: A thin `AIProvider` interface (`generateStructuredOutput<T>(prompt, schema)`, `chat(...)`) with a first concrete adapter for Anthropic's Messages API (structured output validated against Zod schemas per §13 before anything touches the database). Swapping providers later means writing a new adapter, not touching call sites.

**Validation**: Zod for both AI output schemas and form/API input validation — one library, both jobs, no extra dependency.

**Hosting**: Vercel. Environment variables via Vercel project settings for prod/preview, `.env.local` (gitignored) for local dev.

**Testing**: Vitest for unit/service tests (scoring logic, attribution calculations, AI output validation), Playwright for critical-flow end-to-end tests (auth, lead creation, campaign creation, signature submission) — matches §32/§37 without adding a second test runner.

This is a standard, boring, maintainable stack for this kind of internal data/AI product — I'm not proposing anything exotic, since there's no existing constraint pulling us toward a different choice.

## 13. Proposed Implementation Plan

Following your phase order in §38 exactly, since it's well-sequenced (foundation → leads → audits → sales → dating app → tracking → marketing intel → AI advisor → automation → hardening). No changes recommended to that order. Each phase ends with working tested code, a phase report (files changed, DB changes, tests run/passed/failed, how to test it, what's next), then a stop for your approval — per §39 Rule 20.

**Phase 1 — Foundation** (next, pending your approval): repo scaffold (Next.js + TS + Tailwind + shadcn init), Supabase project wiring, initial migrations for `products`, `campaigns`, `activities`, and an auth/`profiles` table, RLS policies, app shell + nav (matching the nav structure in §6), dashboard shell with empty states, activity logging service, basic analytics foundation (no fake numbers — explicit "no data yet" states). Seed exactly two `products` rows: Zviko Labs, Dating App (real, not mock).

**Phase 2 — Zviko Labs Lead Engine**: `businesses`, `contacts`, `lead_scores` tables; discovery entry points (manual add + URL-driven AI research, pending §11 answer on enrichment APIs); dedup logic (name+website+phone+location, never name-similarity-only per §30); CRM pipeline UI with the stated statuses.

**Phase 3 — Website Audit & Opportunity Engine**: `website_audits`, `opportunities` tables; the audit service (fetches public page, evaluates the stated technical/UX/business/SEO/accessibility signals — with honest scope: "basic accessibility signals," not a certification); Opportunity Analyst AI module producing the observed-fact / inference / recommendation split required by §10.

**Phase 4 — Sales Intelligence**: outreach drafts + approval workflow (`outreach` table, DRAFT→PENDING_APPROVAL→APPROVED→SENT state machine, human approval required before any send), proposal generator, sales analytics.

**Phase 5 — Dating App Growth**: `audiences`, `audience_sources` tables, campaign management scoped to the Dating App product, content planning, referral tracking — with the 18+ / no-minors constraint enforced in audience definitions.

**Phase 6 — Signature & Signup Tracking**: `campaign_events`, `signatures`, `referrals`; UTM/referral attribution; explicit consent capture, dedup, optional email verification.

**Phase 7 — Marketing Intelligence**: campaign analytics/funnel/channel comparison, computed only from real stored events — "N/A / insufficient data" where data doesn't exist, never a fabricated number.

**Phase 8 — AI Growth Advisor**: conversational assistant grounded in real DB queries (no free-floating chat that invents answers), daily briefing, recommendation engine with reasoning + supporting metrics + confidence on every recommendation.

**Phase 9 — Automation**: scheduled jobs (Vercel Cron or Supabase Edge Functions + `pg_cron`), starting Observe→Recommend→Human-Approves→Execute for everything; only demonstrably low-risk actions move to Observe→Execute→Report, and only if you explicitly configure that.

**Phase 10 — Production Hardening**: security/performance review, RLS audit via Supabase advisors, accessibility pass, full E2E suite, deploy rehearsal.

## 14. Files That Will Need Modification

None yet exist. Phase 1 will create the initial file tree (`app/`, `lib/`, `supabase/migrations/`, `components/`, `.env.example`, `README.md`, config files). I'll list the actual file diff in the Phase 1 report once it's built, per Rule 20.

---

## Summary for approval

Nothing has been implemented. This document is Phase 0 only: an honest statement that the repo is blank, plus the architecture and plan I intend to execute starting with Phase 1. Please confirm:
1. You're OK with the recommended stack/choices in §12, or want changes.
2. Answers (or "use your defaults") to the open questions in §11.
3. Go-ahead to start Phase 1.

I will not begin Phase 1 until you approve.
