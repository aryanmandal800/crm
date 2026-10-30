# Fivopay Intelligence & Sales CRM

Company-owned web CRM and market-intelligence platform for **Fivopay — MANALIX TECHNOLOGIES PRIVATE LIMITED**. Pune district launch.

**Stack:** Next.js 15 (App Router, server components) · TypeScript · PostgreSQL 16 · Drizzle ORM · Tailwind · Recharts · pdfkit · ExcelJS.
Single repo: web app + REST API + background worker. No external SaaS dependencies; LLM and SMTP are optional.

## Quick start (local)

```bash
cp .env.example .env              # set DATABASE_URL and JWT_SECRET
npm ci
npm run db:migrate                # schema + DB hardening triggers
npm run db:seed                   # reference data + Founder/Aryan/Priya accounts (temp passwords printed ONCE)
npm run build && npm start        # http://localhost:3000
npm run worker                    # separate process: backups, rescoring, reminders, summaries
```

Add `SEED_DEMO=true` to see the UI with eight clearly fictitious `[DEMO]` societies; remove them with `npm run db:purge-demo`.

## What's in it

| Area | Where |
|---|---|
| Founder's Sales Command Centre (13 questions, tomorrow's top 5) | `/command-centre` |
| Analytics dashboard — every KPI drills into its records | `/dashboard` |
| Master lead database, filters, bulk assign, duplicate detection, CSV import | `/leads`, `/leads/import` |
| Institution profile: facts vs. estimates vs. AI, sources, signals, score breakdown, pricing, insights | `/leads/[id]` |
| Deal pipeline — Kanban (drag) + table, 17 stages, stall/overdue flags | `/pipeline`, `/deals/[id]` |
| Activity tracker, My day, Tasks | `/activities`, `/my-day`, `/tasks` |
| Decision-maker CRM | `/decision-makers` |
| Competitor intelligence (evidence-backed only) | `/competitors` |
| Quotes → approval → PDF (continues FP/CP register from 040) | `/quotes`, `/approvals` |
| Lost deals & objection analysis | `/lost-deals` |
| Customer onboarding (auto-created on Won) | `/onboarding` |
| Product & pricing catalogue + calculator | `/catalogue` |
| Research sources & verification queue | `/sources` |
| Team performance + targets | `/performance` |
| Excel/CSV exports | `/reports` |
| Admin change request centre | `/change-requests` |
| Settings & business rules (no-code), users, roles, data-access grants, audit log | `/admin/*` |
| Technical administration dashboard | `/tech` |

## Key rules built in

- **No fabricated data.** Nothing real is seeded. Blank = "Not publicly verified". Every field can carry a classification (verified fact / publicly reported / estimate); AI output is stored and shown separately.
- **Scoring** (`src/lib/scoring.ts`): 8 parameters, out of 100, each with a written reason and missing-info list. Unknowns score 0. Bands and weights editable; extra MANUAL parameters can be added in Settings.
- **Pricing** (`src/lib/pricing.ts`): ₹5 list / ₹3 floor per member per month, editable slabs, minimum billing, implementation, migration, modules, SLA, enterprise uplift. Discounts above the limit or below the floor go to the Super Admin. Third-party costs are always excluded.
- **Closed deals are locked** — at the API *and* by a database trigger. Only the Super Admin can correct a won deal; every change is audited.
- **Audit log is append-only** — the database rejects UPDATE/DELETE.

## Tests

```bash
TEST_BASE_URL=http://localhost:3000 npm run test:rbac    # 51 backend access-control checks
```
Run against **staging**, not production: it creates test users/records and consumes a quote number.

See `DEPLOYMENT.md` (Aryan) and `SECURITY.md`.
