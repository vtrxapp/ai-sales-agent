# Zviko Growth Engine

An internal, private growth/sales/marketing/CRM platform for two business
objectives:

- **Zviko Labs** — a digital product studio, finding and converting
  organizations that need websites, apps, and custom software.
- **Dating App** — a Zimbabwe-focused dating app, growing registrations,
  profiles, and referrals among adults 18+.

This is one unified platform, not two separate apps: `Products → Campaigns →
Audiences/Leads → Opportunities → Actions → Conversions → Analytics`.

Full background, architecture decisions, and the phase-by-phase build plan
are in [`PROJECT_AUDIT.md`](./PROJECT_AUDIT.md). This README is the
practical "how do I run/deploy/test this" guide.

**Current status: Phase 2 (Zviko Labs Lead Engine).** Auth, the app shell,
products, campaigns, lead discovery, the business/prospect database,
lead scoring, and the sales pipeline are functional. Website audits
(Phase 3), outreach, proposals, audiences, signatures, analytics, and
the AI assistant are real pages with honest "coming in Phase N"
placeholders — see the sidebar.

## Architecture at a glance

- **Framework**: Next.js 16 (App Router), TypeScript (strict), Tailwind CSS v4.
- **UI**: hand-built shadcn/ui-style components in `components/ui/` (no
  external UI library dependency — see "Why no shadcn CLI" below).
- **Database/Auth**: Supabase (Postgres + Row Level Security + Supabase Auth).
- **Hosting**: Vercel.
- **AI**: Anthropic (Claude) behind a small provider-agnostic interface
  (`lib/ai/`) — structured output via `messages.parse()` for research/
  scoring, and Claude's hosted web search/fetch tools for lead discovery.
  See "AI setup" below.

This is an **internal tool with no public signup**. Team members are added
directly in the Supabase Dashboard (see below), not through the app.

### Why no shadcn CLI

This environment's network policy blocks `ui.shadcn.com`, so components
were hand-written instead of pulled via `npx shadcn add`. They follow the
same conventions (Tailwind classes, `class-variance-authority` for
variants, `cn()` helper) so they behave like normal shadcn components and
can be extended the same way — just without the CLI as a dependency.

## Project structure

```
app/
  (dashboard)/        Authenticated routes: overview, products, campaigns,
                       leads, prospects, pipeline, and the Phase 3+ stub
                       pages (audiences, outreach, proposals, ...)
  login/               Sign-in page (password + magic link)
  auth/callback/       Supabase magic-link callback
  actions/             Server Actions (auth, campaigns, leads, businesses)
components/
  ui/                  Hand-built shadcn-style primitives
  shell/               Sidebar + topbar (app shell)
  dashboard/           EmptyState, StatCard, ActivityFeed, PhaseStub
  leads/, prospects/   Feature-specific components (discovery, bulk actions,
                       research/score buttons, contact/opportunity forms)
lib/
  ai/                  AIProvider interface + Anthropic adapter (lib/ai/index.ts
                       is the factory - throws a typed error if unconfigured)
  supabase/            Browser/server/admin Supabase clients + proxy session helper
  services/            Business logic (BusinessService, ContactService,
                       LeadResearchService, LeadScoringService,
                       DeduplicationService, ...) — never call Supabase
                       directly from a page/component
  services/discovery/  LeadDiscoveryProvider interface + the AI-web-search
                       implementation (swap in a paid provider later without
                       touching callers)
  validations/         Zod schemas for form/API input and AI structured output
  types/database.types.ts   Generated from the live Supabase schema
  dal.ts               Data Access Layer: getCurrentUser/requireUser/getCurrentProfile
  nav.ts               Sidebar navigation config
proxy.ts               Next.js 16's replacement for middleware.ts — refreshes
                       the Supabase session and redirects unauthenticated
                       requests to /login
supabase/migrations/   SQL migrations, applied in order
```

## AI setup

Lead discovery, research, and scoring need `ANTHROPIC_API_KEY` (get one at
[console.anthropic.com](https://console.anthropic.com/) → API Keys). Add it
to `.env.local` and to your Vercel project's environment variables.

Without it, the rest of the app works normally — those specific actions
return a clear "AI is not configured" message instead of failing silently
or faking a result.

What it's used for:
- **Find Leads** (`/leads`): searches the public web via Claude's hosted
  web search/fetch tools for businesses matching your criteria. This is
  *not* a paid business-data API (Apollo, Clearbit, Google Places, etc.) —
  results depend on what's publicly discoverable, and are shown to you for
  review before anything is saved.
- **Research** (on a prospect's page): fetches and summarizes a business's
  public web presence, split into observed facts, inferences, and
  recommendations — never presented as verified fact when it isn't.
- **Score** (on a prospect's page): produces an explainable 0-100 lead
  score. The total is always recomputed server-side from the seven scored
  components — the AI's own stated total (if any) is never trusted directly.

The model defaults to `claude-opus-5`; override with `ANTHROPIC_MODEL` if
you want a different cost/quality tradeoff.

## Setup

### 1. Prerequisites

- Node.js 20.9+ (Node 22 recommended — this repo was built and tested on 22.22.2)
- A Supabase project (see below)

### 2. Install dependencies

```bash
npm install
```

### 3. Supabase project

This app expects its **own** dedicated Supabase project — not shared with
any other app's database. (The team's account already has one other
Supabase project that is a different app's live database; do not point
this app at that project.)

If you don't have a Growth Engine Supabase project yet:

1. [supabase.com/dashboard](https://supabase.com/dashboard) → your
   organization → **New project**.
2. Note the **Project URL** and the **anon/publishable key** from
   **Project Settings → API**.
3. Apply the migrations in `supabase/migrations/` in order, either:
   - Via the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started):
     `supabase link --project-ref <your-ref>` then `supabase db push`, or
   - By pasting each file's contents into the Supabase Dashboard's SQL
     Editor, in filename order (they're numbered).

### 4. Environment variables

Copy `.env.example` to `.env.local` and fill in the two Supabase values:

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-or-publishable-key>
```

`SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` are placeholders for
Phase 2+ — leave them blank for now. **Never** commit `.env.local` or put
real secrets in `.env.example`.

### 5. Create your first user

There is no public sign-up page — this is an internal tool. Add yourself
directly in Supabase:

1. Supabase Dashboard → **Authentication → Users → Add user**.
2. Enter your email (use a real address you can receive mail at if you
   want to test the magic-link sign-in) and a password.
3. A matching row in `public.profiles` is created automatically (see the
   `handle_new_user` trigger in the first migration) — nothing else to do.
4. Sign in at `/login` with that email/password, or use "Sign in with a
   magic link instead."

### 6. Run it

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) — you'll be redirected
to `/login`, then to `/overview` after signing in.

## Testing

```bash
npm run test        # Vitest — service/validation unit tests
npm run test:e2e     # Playwright — auth + navigation end-to-end tests
```

Playwright needs a running dev server; most tests need no credentials
(unauthenticated redirects, login page rendering). One authenticated
test (`tests/e2e/auth.authenticated.spec.ts`) is skipped unless you set
`E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` for a real test account you create
yourself (see "Create your first user" above) — see `playwright.config.ts`
and `tests/e2e/` for what's covered today.

The AI-calling code paths (discovery, research, scoring) are unit-tested
at the validation/logic layer (Zod schemas, score classification,
deduplication matching) with mocked inputs, since this environment has no
`ANTHROPIC_API_KEY` configured to make a real call against. If you have a
key, exercising `/leads` → Research → Score once by hand is worth doing
after pulling this branch.

## Deployment (Vercel)

1. Import the GitHub repo into a **new** Vercel project (this repo isn't
   currently linked to any existing Vercel project in the team's account).
2. Set the same environment variables from `.env.local` in **Project
   Settings → Environment Variables** (Production and Preview).
3. Deploy. No build-step configuration is required beyond the defaults.

## Security notes

- Row Level Security is enabled on every table; every policy requires an
  authenticated Supabase session (`to authenticated`) — there is no
  anonymous read/write path anywhere in the schema.
- The service-role key (when it's introduced in a later phase) must only
  ever be used from `lib/supabase/admin.ts` on the server — never in a
  Client Component, never sent to the browser.
- `proxy.ts` (Next.js 16's renamed `middleware.ts`) does an *optimistic*
  auth check on every request; the real check happens server-side via
  `lib/dal.ts` and RLS, per Next.js's recommended Data Access Layer pattern.

## Troubleshooting

- **"Failed to load campaigns" / similar errors on a page**: almost
  always means the Supabase env vars in `.env.local` don't match a project
  that has had the migrations applied. Check `NEXT_PUBLIC_SUPABASE_URL`.
- **Redirected to `/login` in a loop**: your Supabase session cookie may be
  stale — sign out, clear cookies for `localhost:3000`, sign in again.
- **New user can't see any data**: RLS requires an authenticated session;
  confirm the user was created via the Dashboard (not some other path) and
  that `public.profiles` has a matching row.

## Known limitations (Phase 2)

- Opportunities proposed by AI research aren't deduplicated against a
  prior research run on the same business — re-researching can add
  overlapping opportunity rows. Manual cleanup for now; proper dedup is a
  Phase 3 concern alongside the fuller Opportunity Engine.
- There's no delete UI for businesses/contacts/opportunities (same
  precedent as campaigns in Phase 1) — correct mistakes by editing, or
  move a business's status along instead of removing it.
- Bulk research/score is capped at 10 businesses per action (AI calls are
  slower and rate-limited; bulk status updates have no such cap).
- The sales pipeline is a reliable column view with a status dropdown per
  card, not drag-and-drop (the spec explicitly allows this as the
  fallback).

## Roadmap

See `PROJECT_AUDIT.md` for the full phase plan (Phase 3: Website Audits &
Opportunity Engine, Phase 4: Sales Intelligence, Phase 5: Dating App
Growth, Phase 6: Signatures, Phase 7: Marketing Intelligence, Phase 8: AI
Growth Advisor, Phase 9: Automation, Phase 10: Production Hardening).
