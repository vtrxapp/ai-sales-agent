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

**Current status: Phase 5 (Actual Outreach Infrastructure).** Auth, the
app shell, products, campaigns, lead discovery, the business/prospect
database, lead scoring, website audits, the full opportunity engine,
the sales pipeline, sales strategy generation, WhatsApp/email outreach
drafting, and now **actual sending** — via the official WhatsApp
Business Platform (Meta Cloud API) and Resend — are functional, always
behind an explicit human confirmation. Proposals, audiences,
signatures, analytics, and the AI assistant are real pages with honest
"coming in Phase N" placeholders — see the sidebar. AI replies,
automated follow-ups, and mass sending are explicitly out of scope for
this phase (and the next).

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
                       leads, prospects, pipeline, and the Phase 5+ stub
                       pages (audiences, outreach, proposals, ...)
  login/               Sign-in page (password + magic link)
  auth/callback/       Supabase magic-link callback
  actions/             Server Actions (auth, campaigns, leads, businesses, outreach)
components/
  ui/                  Hand-built shadcn-style primitives
  shell/               Sidebar + topbar (app shell)
  dashboard/           EmptyState, StatCard, ActivityFeed, PhaseStub
  leads/, prospects/   Feature-specific components (discovery, bulk actions,
                       research/score/audit buttons, contact/opportunity forms,
                       Generate Outreach action, outreach draft review card)
lib/
  ai/                  AIProvider interface + Anthropic adapter (lib/ai/index.ts
                       is the factory - throws a typed error if unconfigured)
  outreach/            OutreachProvider interface + the concrete
                       WhatsAppCloudApiProvider (Meta Cloud API) and
                       ResendEmailProvider, a config-driven factory
                       (index.ts) that throws a typed *NotConfiguredError
                       when credentials are missing, and test-only mock
                       providers (never wired into the factory)
  supabase/            Browser/server/admin Supabase clients + proxy session helper
  services/            Business logic (BusinessService, ContactService,
                       LeadResearchService, LeadScoringService,
                       WebsiteAuditService, OpportunityAnalysisService,
                       OpportunityService (dedup + scoring),
                       NextActionService (pure decision tree),
                       SalesStrategyService, OutreachDraftService,
                       OutreachSendService (the send/retry state
                       machine + idempotency), phone-normalization (pure,
                       WhatsApp-API-ready number formatting),
                       opportunity/contact/channel-selection (pure,
                       deterministic), message-quality (validation +
                       personalization scoring, pure), DeduplicationService,
                       ...) — never call Supabase directly from a page/component
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
- **Audit Website** (on a prospect's page): one button that chains three
  steps — (1) validates the business's website URL and records `NO_WEBSITE`/
  `INVALID_URL` without calling the AI if there's nothing to audit; (2)
  researches the live site via Claude's hosted web tools and extracts 8
  category scores (Technical/Mobile/UX/Accessibility/SEO/Content/Conversion/
  Functionality), each backed by observed/inferred findings with evidence;
  the server always computes `overall_score` from documented, changeable
  weights (`AUDIT_CATEGORY_WEIGHTS` in `lib/services/website-audit-service.ts`)
  — never an AI-stated total; (3) always re-analyzes opportunities from the
  audit plus prior research (no fresh web call), producing an explainable
  0-100 opportunity score from 6 components. Opportunities are deduplicated
  by (business, type, normalized title): a repeat detection updates the
  existing row and bumps `times_detected` rather than creating a duplicate.
  Website content fetched during research is treated as untrusted data —
  the prompts explicitly instruct the model to ignore any instruction-like
  text found on a page and never let it override these system prompts.

- **Generate Outreach** (on a prospect's page): chains two AI calls behind
  deterministic selection logic. First, `selectPrimaryOpportunity`
  (`lib/services/opportunity-selection.ts`) picks the opportunity to sell -
  purely from the already-validated stored scores, not an AI decision - and
  `selectBestContact`/`determineChannel` pick the contact and channel from a
  fixed priority ladder (a phone number is *never* automatically treated as
  a WhatsApp number - only an explicit `whatsapp_status: AVAILABLE` counts).
  A single AI call then builds a **sales strategy** around that fixed
  context (problem, evidence, angle, value proposition, objections) -
  it never re-picks the opportunity, service, contact, or channel. A second
  AI call generates up to 3 message variants (Recommended/Direct/
  Conversational) for the one channel already chosen - never both channels,
  and never a fresh web search (it reuses research/audit evidence already
  on file). Every draft is then run through **deterministic** validation
  (placeholders, banned generic phrases, length, suspicious URLs, an
  evidence anchor check) and a **deterministic** 0-100 personalization
  score (`lib/services/message-quality.ts`, weights documented in
  `PERSONALIZATION_WEIGHTS`) - neither is ever AI self-graded. A draft that
  fails validation is marked `NEEDS_REVIEW` and cannot be approved until
  edited (which always re-validates) or regenerated.

None of this ever sends anything on its own — no WhatsApp, email, or SMS,
and no automatic contact of any business. Approving a draft only sets its
status to `READY_TO_SEND`; a *separate* explicit Send action (with its own
confirmation step) is what actually dispatches a message - see "Sending
setup" below - and the prospect's pipeline status is never changed
automatically either way. The prospect page's "Next recommended action"
is a deterministic recommendation (a pure decision tree in
`lib/services/next-action-service.ts`, not an AI call) for a human to act
on manually.

The model defaults to `claude-opus-5`; override with `ANTHROPIC_MODEL` if
you want a different cost/quality tradeoff.

## Sending setup

Actually sending a message (as opposed to drafting one) needs its own
provider credentials, entirely separate from `ANTHROPIC_API_KEY`. Without
them, Send shows a clear configuration error naming exactly what's
missing - it never fakes a successful send. Check current status any
time at `/outreach` (configured/not, sender identity, no secrets shown).

### WhatsApp (official WhatsApp Business Platform / Meta Cloud API)

This app only ever calls the official Cloud API - never WhatsApp Web
automation, browser control, or an unofficial library.

1. Create a Meta app with the WhatsApp product added, a test or
   production WhatsApp Business phone number, and a **System User**
   access token (recommended for production - it doesn't expire the way
   a temporary token does) with the `whatsapp_business_messaging` and
   `whatsapp_business_management` permissions. See
   [Meta's WhatsApp Cloud API documentation](https://developers.facebook.com/docs/whatsapp/cloud-api)
   for current steps - verify against the live docs before assuming
   anything here is still accurate, since Meta revises this fairly
   often.
2. **Create and get approval for a message template** in Meta Business
   Manager. This is not optional: a business can only send free-form
   text to someone who has messaged it within the last 24 hours: cold/
   business-initiated outreach - this app's only use case - requires a
   pre-approved template. One generic template with a single body
   variable (the approved draft text is passed as that variable) is
   enough; no code change is needed once it exists and is approved.
3. Set `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
   `WHATSAPP_TEMPLATE_NAME`, and `WHATSAPP_TEMPLATE_LANGUAGE` (e.g. `en`)
   in `.env.local` (and in Vercel for deployment). Leave
   `WHATSAPP_API_VERSION` unset unless you need to override the version
   pinned in `lib/outreach/whatsapp-provider.ts`.

### Email (Resend)

1. Create a [Resend](https://resend.com) account, verify a sending
   domain, and create an API key.
2. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (an address on your
   verified domain) in `.env.local`. `RESEND_FROM_NAME` is optional.

Swapping either provider for a different one (e.g. SendGrid/SES instead
of Resend) means writing a new class implementing `OutreachProvider` in
`lib/outreach/` - no changes needed anywhere that calls
`sendOutreachMessage`.

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

`SUPABASE_SERVICE_ROLE_KEY` is a placeholder, not used yet — leave it
blank. `ANTHROPIC_API_KEY` (drafting) and the `WHATSAPP_*`/`RESEND_*`
variables (actual sending — see "Sending setup" above) can also be left
blank to run the rest of the app; each missing group disables only its
own feature with a clear message, never a silent failure. **Never**
commit `.env.local` or put real secrets in `.env.example`.

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

The AI-calling code paths (discovery, research, scoring, website audits,
opportunity analysis, sales strategy, outreach drafts) are unit-tested at
the validation/logic layer (Zod schemas, score/priority classification,
dedup matching, the audit-weighting math, the next-action decision tree,
opportunity/contact/channel selection, message validation and
personalization scoring, the draft lifecycle) with mocked inputs and a
fake Supabase client, since this environment has no `ANTHROPIC_API_KEY`
configured to make a real call against. The same is true of the sending
path: `outreach-send-service.test.ts` exercises the full state machine
(authorization, suppression, idempotency/concurrency, retries) against a
fake Supabase client with a mocked provider factory, and
`whatsapp-provider.test.ts`/`email-provider.test.ts` exercise the real
`WhatsAppCloudApiProvider`/`ResendEmailProvider` classes (request shape,
response parsing, error classification) against a mocked `fetch` — no
real WhatsApp/Resend credentials needed to run any of this. A Vitest
module needing the bare `server-only` import to resolve (any real
provider adapter) is satisfied via the `server-only` alias in
`vitest.config.mts` pointing at `lib/testing/server-only-stub.ts` — see
the comment there for why Vitest needs this and Next's own build doesn't.
If you have real credentials, exercising `/leads` → Research → Score →
Audit Website → Generate Outreach → approve a draft → Send once by hand
is worth doing after pulling this branch — in particular:
- re-running Research or Audit Website on the same business a second time
  to confirm opportunities update in place (`times_detected` increments)
  instead of duplicating;
- re-running Generate Outreach on the same business to confirm it reuses
  the existing drafts rather than silently creating duplicates, and that
  Regenerate creates fresh ones without deleting the old ones;
- reading a generated message and judging honestly whether it reads like
  it was actually researched, or like generic AI spam (see the Phase 4
  report's "realistic message quality" section for how this was assessed
  without a live key).

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
- **Sending (Phase 5)**: `WHATSAPP_ACCESS_TOKEN`/`RESEND_API_KEY` are read
  only inside `server-only`-guarded modules under `lib/outreach/` and
  never appear in client bundles, database rows, activity metadata, or
  logs — provider errors are translated into fixed, friendly messages
  (see `classifyWhatsAppError`/`classifyResendError`) rather than
  surfacing the provider's raw response. A send is only ever triggered
  by a server action that re-verifies everything itself from the
  database — the draft's approval status, validation status, business
  suppression (`do_not_contact`), and the recipient address — never
  trusting client-supplied values for any of it (see the "Never accept
  the entire message/recipient as trusted client-provided values" style
  comments in `lib/services/outreach-send-service.ts`). Idempotency is
  enforced at the database level two ways: an optimistic
  `READY_TO_SEND → SENDING` status transition guarded by
  `.eq("status", ...)` (Postgres serializes concurrent updates to the
  same row, so only one concurrent request can ever win it), and a
  unique partial index (`outreach_send_attempts_one_pending_per_draft`)
  allowing at most one `PENDING` attempt per draft — not just a disabled
  button in the UI.

## Troubleshooting

- **"Failed to load campaigns" / similar errors on a page**: almost
  always means the Supabase env vars in `.env.local` don't match a project
  that has had the migrations applied. Check `NEXT_PUBLIC_SUPABASE_URL`.
- **Redirected to `/login` in a loop**: your Supabase session cookie may be
  stale — sign out, clear cookies for `localhost:3000`, sign in again.
- **New user can't see any data**: RLS requires an authenticated session;
  confirm the user was created via the Dashboard (not some other path) and
  that `public.profiles` has a matching row.

## Known limitations (Phase 5)

- **No live WhatsApp or email credentials were available in the build
  environment**, so no real message was actually sent during this
  phase — see the Phase 5 report for exactly what was and wasn't
  verified live versus via mocked unit tests, and "Sending setup" above
  for how to configure real credentials.
- **A confirmed browser session could not be created in this sandbox**
  to click through the new Send UI live end-to-end: there's no way to
  receive a magic-link email here, and a directly-inserted `auth.users`
  row (the standard local-seed pattern, bcrypt hash and all) was
  rejected by Supabase Cloud's hosted Auth with "Incorrect email or
  password" for a reason not diagnosable without deeper access to that
  project's Auth configuration. The UI was verified by careful code
  review plus the full Vitest suite instead — see the Phase 5 report.
  If you have real login credentials for this project, a manual
  click-through of Approve → Send → confirm → history is worth doing.
- **Delivery/read tracking isn't implemented.** A successful send only
  ever records `SENT` (the provider accepted the request) - never
  `DELIVERED`/`READ`/`OPENED`, which would need inbound webhook
  infrastructure this phase deliberately doesn't build (spec: no
  inbound webhooks this phase). `SENT` means "handed to the provider,"
  not "the recipient saw it."
- **Suppression (Do Not Contact) is business-level, not per-contact.**
  The safer default (blocks every channel/contact for that business),
  and this app has no standalone contact detail page to hang
  per-contact suppression UI off yet.
- **No automatic reconciliation for a send stuck mid-flight.** If the
  server process crashes between the provider confirming a send and
  this app recording that outcome, the draft can be left in `SENDING`
  with no way to tell — from inside the app — whether the message
  actually went out. This is a known gap of not having a distributed
  transaction across an external HTTP call and a database write; a
  real occurrence would need checking the provider's own message log
  and fixing the row by hand. Genuinely rare in practice (it requires a
  crash in a very small window), not something this phase's scope
  covers building automated recovery for.
- **Phone normalization covers Zimbabwe only** (the only country this
  app currently has verified users in) via a per-country config
  (`lib/services/phone-normalization.ts`); adding another country is a
  new `CountryPhoneConfig` entry, not a rewrite - but a genuinely
  ambiguous number that matches more than one configured country's
  shape isn't resolvable by this phase's simple single-pass matcher.
- **WhatsApp Cloud API details were verified via web research this
  session, not by fetching Meta's own docs directly** —
  `developers.facebook.com` is blocked from this sandbox's network, so
  the endpoint shape, template requirement, and error codes were
  cross-checked across several independent third-party sources instead
  of read directly from Meta. Re-verify against
  [developers.facebook.com/docs/whatsapp](https://developers.facebook.com/docs/whatsapp/cloud-api)
  before relying on this in production, since Meta revises these APIs
  periodically.
- **Analytics' "by industry" breakdown covers sent messages only**, not
  the "by opportunity type" cut the spec also mentions — that needs an
  extra join through drafts→opportunities this phase didn't add, to
  keep the dashboard query simple; a reasonable follow-up, not a gap in
  what actually gets sent or recorded.

## Known limitations (Phase 4)

- **Message validation is rule-based, not semantic.** It reliably catches
  unfilled placeholders, banned generic phrases, excessive/too-short
  length, suspicious URLs, a numeric claim untraceable to recorded
  evidence, and a missing business/contact/evidence reference - it cannot
  verify deep factual accuracy. This is exactly why human approval is
  still mandatory regardless of whether validation passes.
- **Generate Outreach targets one channel per click** (whichever
  `determineChannel` recommends), not both WhatsApp and email - a
  deliberate cost/scope decision (spec section 24: no accidental bulk
  generation). Regenerate re-runs the same channel; there's no button yet
  to also draft the other channel.
- **No bulk outreach generation** - one prospect at a time, matching the
  spec's explicit cost-control requirement.
- **APPROVED and READY_TO_SEND are collapsed into one action.** The single
  Approve button sets a draft straight to `READY_TO_SEND` (matching the
  spec's own flow diagram: "user approves → becomes READY_TO_SEND"); the
  `APPROVED` enum value exists in the database for a possible future
  two-step review but nothing in this phase's UI produces it. Worth
  flagging in case a two-step review was actually intended.
- **The `products` table is business lines, not a services catalog** (2
  rows: Zviko Labs, Dating App). Spec section 29's "existing product/
  service structure" is interpreted as `opportunity_type` - the enum
  already used throughout Phases 2-3 as Zviko Labs' service categories -
  plus the opportunity's own `recommended_service` text; `NO_MATCHING_SERVICE`
  is returned only when neither is usable, never an invented service name.
- Sales strategies and outreach drafts are never deleted, only superseded/
  cancelled - full history stays on the business (consistent with audits
  and opportunities).
- As with Phase 1-3, there's no automated authenticated end-to-end test for
  the new sales-intelligence/outreach UI - see "Testing" above for what is
  covered, and no live AI verification was possible this session (no
  `ANTHROPIC_API_KEY` configured) - see the Phase 4 report.

## Known limitations (Phase 3)

- **No bulk website audit.** A single audit chains up to 3 AI calls
  (research + audit extraction + opportunity analysis); a bulk version
  across 10 businesses could mean ~30 sequential AI calls in one request,
  which risks exceeding a serverless function's time budget. Audits are
  per-business only for now (see `ResearchScoreActions`); Research and
  Score still have bulk actions from Phase 2.
- **`maxDuration = 60` on the prospect detail page** may not be enough for
  an audit of a slow site on some Vercel plans (audits chain 3 sequential
  AI calls). Raise it in `app/(dashboard)/prospects/[id]/page.tsx` if your
  plan supports a higher function duration and you see audits time out.
- **No fuzzy opportunity matching, by design.** Dedup matches on exact
  (business, opportunity type, normalized title) only — a differently
  worded re-detection of the same underlying problem creates a second row
  rather than risk silently merging two distinct problems. Same
  philosophy as business dedup (`deduplication-service.ts`).
- Website audits never bypass access restrictions (robots.txt, logins,
  paywalls, CAPTCHAs) — a site protected this way is recorded as
  `UNREACHABLE` with an explanation, not scored.
- There's still no delete UI for businesses/contacts/opportunities/audits
  (same precedent as campaigns in Phase 1) — audits are append-only by
  design (full history, never overwritten); correct other mistakes by
  editing, or move a business's status along instead of removing it.
- Bulk research/score is capped at 10 businesses per action (AI calls are
  slower and rate-limited; bulk status updates have no such cap).
- The sales pipeline is a reliable column view with a status dropdown per
  card, not drag-and-drop (the spec explicitly allows this as the
  fallback).
- As with Phase 1/2, there's no automated authenticated end-to-end test
  for the new website-audit/opportunity UI — see "Testing" above for what
  is covered, and the Phase 3 report for why (no test credentials
  available to this environment).

## Roadmap

Phase 5 (this phase) added actual outreach sending — WhatsApp Business
Platform + Resend, against the `OutreachProvider` interface prepared in
Phase 4 — per this phase's explicit instructions. Recommended next
(per the Phase 5 report): reply/response tracking and a lightweight CRM
follow-up workflow, still with no AI-driven auto-replies or negotiation.
Note this differs from `PROJECT_AUDIT.md`'s original Phase 0 plan, where
Phase 5 was Dating App Growth; see the Phase 4 report for this
discrepancy. Beyond sending, see `PROJECT_AUDIT.md` for the rest of the
phase plan (Dating App Growth, Signatures, Marketing Intelligence, AI
Growth Advisor, Automation, Production Hardening).
