# PROJECT_AUDIT.md — Zviko Growth Engine

**Phase:** 0 — Repository & System Audit (finalized)
**Date:** 2026-09-05
**Repository:** `vtrxapp/ai-sales-agent`
**Branch:** `claude/funny-rubin-krs6p4`

---

## 0. Headline Findings

1. **The `ai-sales-agent` repository itself is empty.** Zero commits, no branches, no default branch — verified via local git (`git log`, `git fetch` return nothing) and the GitHub API (`409 Git Repository is empty`). This is a greenfield build for the Growth Engine codebase.

2. **Your Supabase and Vercel accounts are not empty — and neither is a clean fit for reuse as-is.** Since you asked me to prepare real Supabase configuration/migrations and to connect Vercel if possible, I checked what already exists in your accounts before proposing anything. Both checks turned up something you need to decide on before I proceed (see §11). Nothing has been created, modified, or provisioned — these are read-only findings.

---

## 1–2. Current Architecture / Existing Functionality (this repo)

None. No framework, no code, no config files of any kind.

## 3. Existing Integrations

None inside this repository. However, your connected accounts already contain infrastructure worth knowing about before I wire anything up (details in §11):

- **One Supabase project**: `oppwmtqpfxlbogqpehtw` ("nhamo.masanganise@gmail.com's Project", region `eu-west-1`, Postgres 17, status healthy, created 2026-09-04).
- **One Vercel project**: `vtrxapp` (team `vtrxapp's projects`, hobby plan), linked to GitHub repo `vtrxapp/vtrxapprepo` — a **different** repository from this one.

## 4. Database Structure

None in this repo (no migrations directory). The existing Supabase project (above) does have a schema already — but it is not a Growth Engine schema. See §11 for what it contains and why that matters.

## 5. Authentication

None implemented in this repo.

## 6. Current Deployment

No CI/CD, no `vercel.json`, no Dockerfiles in this repo. The `vtrxapp` Vercel project above is not connected to this repository.

## 7. Problems Discovered

- Empty repo, no `.gitignore` previously — already fixed (added in the first Phase 0 commit).
- The existing Supabase project's schema (see §11) contains what appears to be **live product data** (a `waitlist_signups` table with 1 real row). I did not read that row's contents — only confirmed the table exists and its row count — since it may contain a real person's PII and reading it isn't necessary for this audit.

## 8. Security Concerns

Nothing existing to have a vulnerability yet. Design commitments carried over from the initial audit, now firm given your decisions:
- Every Growth Engine table gets Row Level Security from its first migration — internal-staff-only access, no public reads/writes.
- Supabase service-role key and Anthropic API key live server-side only (Next.js Route Handlers / server components), never shipped to the client bundle, never committed — `.env.example` with placeholders, real values in Vercel project env vars or a gitignored `.env.local`.
- **Blast-radius concern specific to this project**: if the Growth Engine ends up sharing a Postgres instance with the live Dating App's operational data (real users, messages, payment transactions, safety check-ins), a misconfigured RLS policy or a bug in an internal tool used by less security-conscious workflows (AI-assisted queries, ad-hoc dashboards) becomes a much bigger risk than if the two are isolated. This is the main driver behind the recommendation in §11.

## 9. What Can Be Reused

Nothing in-repo. At the infrastructure level: your Vercel team/account and Supabase account are usable as the *home* for new projects, even if the specific existing projects aren't reused directly (see §11).

## 10. What Needs to Be Built

Everything, per your spec, per the phase plan in §13.

---

## 11. Decisions Confirmed, and Two That Still Need Your Input

### Confirmed (from your last message — no longer open)

| # | Topic | Decision |
|---|---|---|
| 1 | Supabase | Use Supabase Postgres. Don't auto-provision — prepare config/migrations/schema and exact manual setup steps instead. *(See finding below — this now has a sub-decision.)* |
| 2 | AI provider | Anthropic (Claude) as the first concrete provider behind a swappable `AIProvider` abstraction. |
| 3 | Deployment | Vercel. Connect the existing project if one already fits; don't create duplicates. *(See finding below — this also has a sub-decision.)* |
| 4 | Auth | Supabase Auth, internal team only, no public signup. |
| 5 | Lead discovery | Manual/URL-driven AI research first (industry, location, business type, search criteria, business URLs, search queries as inputs). Provider-abstracted so a paid enrichment API (Apollo/Clearbit/Google Places/etc.) can be added later without a redesign. No commitment to any paid provider yet. Geographic priority: Harare → Zimbabwe → Africa → international. Every researched fact records `source`, `source_url`, `discovered_at` where available. No fabricated business data, and never claim an external API was called when it wasn't. |

### Still needs your decision: Supabase project placement

The one existing Supabase project in your account (`oppwmtqpfxlbogqpehtw`) already has a real schema — and it's not a Growth Engine schema. Its tables are:

```
User, Profile, ProfilePhoto, QuestionnaireResponse, Match, Message,
Report, Block, SafetyCheckin, Subscription, PaymentTransaction,
waitlist_signups (1 row)
```

This reads as the **operational database for the Zimbabwe Dating App itself** (Product B) — user accounts, matching, messaging, safety reporting, and payments — not an empty or generic default project. It is **not** "a dedicated Supabase project for [the Growth Engine]" in the sense your instruction meant, so per your own rule I have not touched it.

I recommend **against** putting Growth Engine tables (`businesses`, `campaigns`, `outreach`, `lead_scores`, etc.) into this same project, for two reasons:
1. **Risk isolation** — the Growth Engine is an internal tool with AI-assisted workflows and a wider set of contributors/queries over time. It should never be one RLS-policy mistake away from exposing real users' messages, safety reports, or payment transactions.
2. **Clean separation of concerns** — this Postgres instance's schema is clearly the dating app product's own backend, actively in use (`waitlist_signups` already has a real signup). The Growth Engine's job is to *observe and analyze* signals from Product B (e.g., via its own `campaign_events`/`signatures` tables, or later a read path into this database for real metrics), not to live inside its schema.

**My recommendation:** create a **new, separate Supabase project** dedicated to the Growth Engine, in the same organization (`xecjprjibrtwqcyqoiri`). I have not created it — you asked me not to auto-provision. Once you create it (or tell me to), I'll apply the Phase 1 migrations to it.

**Exact manual steps for you** (5 minutes, free tier is enough to start):
1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → your organization → **New project**.
2. Name it something like `zviko-growth-engine` (to avoid confusion with the dating app's project).
3. Choose a region close to your primary users (e.g., same `eu-west-1`, or one closer to Zimbabwe/Africa if a better option is offered — availability varies).
4. Set and store a strong database password (a password manager, not in chat/repo).
5. Once created, go to **Project Settings → API** and note down: **Project URL**, **anon/public key**, **service_role key** (keep this one secret — server-side only).
6. Send me the **Project ID/ref** (not the keys — I can fetch keys myself via the Supabase MCP tool once you tell me which project to use, or you can paste them into Vercel env vars directly).

Alternative you may prefer instead: if you'd rather keep everything in one Supabase project (e.g., for cost reasons on a free-tier account), I can instead build the Growth Engine tables under a **separate Postgres schema** (e.g., `growth` instead of `public`) within the *same* project, with RLS scoped so the Growth Engine's roles have zero access to the dating app's tables and vice versa. This is a real option, just a slightly weaker isolation boundary than a separate project (same instance, same backups/downtime domain, same billing). Tell me which you prefer — **new project (recommended)** or **shared project, separate schema**.

### Still needs your decision: Vercel project placement

The one existing Vercel project (`vtrxapp`) is linked to a **different** GitHub repository (`vtrxapp/vtrxapprepo`), not `ai-sales-agent`. I don't know what that repo is (it's outside this session's scope, and I won't add it without your say-so) — possibly the Dating App's own frontend, or something else entirely.

Either way, it's not correct to repoint that existing project at `ai-sales-agent` — that would disconnect whatever `vtrxapprepo` currently deploys, which I won't do without you explicitly asking for it.

**My recommendation:** create a **new Vercel project** in the same team (`vtrxapp's projects`), linked to `vtrxapp/ai-sales-agent`, named e.g. `zviko-growth-engine`. This isn't a "duplicate" by your rule — no project currently serves this repo at all.

I can do this myself with the Vercel MCP tools (`create_git_project` / `deploy_to_vercel`) once you confirm, or you can do it manually:
1. [vercel.com/new](https://vercel.com/new) → import `vtrxapp/ai-sales-agent` (once it has a Next.js app in it, after Phase 1).
2. Set the same environment variables (Supabase URL/keys, Anthropic API key) in **Project Settings → Environment Variables**.

I'd suggest holding the actual Vercel project creation until after Phase 1 produces a real Next.js app to deploy (an empty repo has nothing to build yet) — but wanted to flag the discovery now since you asked about connecting it during this audit.

**What I need from you to proceed to Phase 1**: (a) new Supabase project vs. shared-project-separate-schema, and (b) confirmation to create a new Vercel project (now or after Phase 1 scaffolding exists — my suggestion is after).

---

## 12. Recommended Architecture (confirmed)

- **Framework**: Next.js 14+ (App Router), TypeScript strict mode, Server Components by default, client components only where interactivity requires it.
- **Styling/UI**: Tailwind CSS + shadcn/ui.
- **Database**: Supabase Postgres, migrations checked into `supabase/migrations/`, RLS on every table from migration #1, `source`/`source_url`/`discovered_at` columns on every externally-sourced table.
- **Auth**: Supabase Auth, email/password + magic link, internal-only — no open signup; users created/invited directly by you.
- **Server-side services**: Next.js Route Handlers for anything touching secrets; business logic in `lib/services/*` (`BusinessResearchService`, `WebsiteAuditService`, `LeadScoringService`, `OpportunityService`, `OutreachService`, `CampaignService`, `AnalyticsService`, `AudienceResearchService`, `AIService`, `SignatureService`, `ReferralService`, `NotificationService`), never inline in UI components.
- **AI abstraction**: `AIProvider` interface (`generateStructuredOutput<T>(prompt, zodSchema)`, `chat(...)`), first adapter = Anthropic Messages API. Adding a second provider later = new adapter, no call-site changes.
- **Lead-discovery abstraction**: a `BusinessResearchProvider` interface parallel to the AI abstraction. V1 adapter = "manual/URL-driven" — takes structured input (industry, location, business type, free-text search criteria, business URLs, search queries), uses the AI layer to research/summarize *only from URLs and text you provide or that are fetched live from the public web*, and writes `source_url` + `discovered_at` on everything it stores. A future adapter (Google Places, Apollo, Clearbit, etc.) implements the same interface; nothing above it changes. No paid provider is wired in now.
- **Validation**: Zod, for both AI-output schemas and API/form input.
- **Hosting**: Vercel, new project per §11.
- **Testing**: Vitest (services/scoring/attribution logic) + Playwright (critical E2E flows).

## 13. Proposed Implementation Plan

Unchanged from the initial audit — your §38 phase order, as-is:

Phase 1 Foundation → Phase 2 Zviko Labs Lead Engine → Phase 3 Website Audit & Opportunity Engine → Phase 4 Sales Intelligence → Phase 5 Dating App Growth → Phase 6 Signature & Signup Tracking → Phase 7 Marketing Intelligence → Phase 8 AI Growth Advisor → Phase 9 Automation → Phase 10 Production Hardening.

Each phase: implement → test → verify DB/UI/API/security/edge cases → update docs → report (files changed, DB changes, tests run/passed/failed, how to test, what remains, recommendation) → **stop for approval**.

Phase 1 specifically will need, once you answer §11: repo scaffold (Next.js/TS/Tailwind/shadcn), Supabase project wired (new project, or shared-schema — per your choice), migrations for `products`, `campaigns`, `activities`, `profiles`/auth, RLS policies, app shell + nav, dashboard shell with honest empty states, activity logging, `.env.example`, README. Seed exactly two real `products` rows: Zviko Labs, Dating App.

## 14. Files That Will Need Modification

None yet exist beyond this audit and `.gitignore`. Phase 1 will create the initial tree; I'll report the actual diff then.

---

## Summary for approval

Repo confirmed empty; your five decisions are locked in. Two sub-decisions remain, both about *where* to put real infrastructure, not about the Growth Engine's design:

1. **Supabase**: new dedicated project (recommended) or shared project with a separate `growth` schema?
2. **Vercel**: OK to create a new project linked to `ai-sales-agent` (I can do it now, or after Phase 1 has something to deploy — I'd suggest after)?

Once you answer those, I'll begin Phase 1. No application code, migrations, or infrastructure have been created yet.
