# Deployment & operations — for Aryan

## Requirements
Ubuntu 22.04+/Debian 12, 2 vCPU / 4 GB RAM minimum, Node.js 22 LTS, PostgreSQL 16 (+ `pg_trgm`, ships with contrib), `pg_dump` on PATH, Nginx + certbot. Or Docker Engine + Compose.

## Option A — Docker Compose
```bash
cp .env.example .env            # fill JWT_SECRET, APP_URL, SEED_* ; DATABASE_URL is set by compose
export DB_PASSWORD='strong-password'
docker compose up -d --build    # app runs migrations on start
docker compose exec app npm run db:seed     # once — note the temporary passwords
```
App listens on 127.0.0.1:3000 only; put Nginx (`deploy/nginx.conf`) + TLS in front.

## Option B — bare metal (PM2)
```bash
sudo -u postgres psql -c "create user fivopay with password '...'" -c "create database fivopay_crm owner fivopay"
sudo -u postgres psql fivopay_crm -c "create extension if not exists pg_trgm"   # needs superuser once
git clone … && cd fivopay-crm && cp .env.example .env    # edit
npm ci && npm run db:migrate && npm run db:seed && npm run build
pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
sudo cp deploy/nginx.conf /etc/nginx/sites-available/fivopay-crm && sudo ln -s ../sites-available/fivopay-crm /etc/nginx/sites-enabled/
sudo certbot --nginx -d crm.fivopay.com
```

## Go-live checklist
- [ ] `JWT_SECRET` ≥ 32 random chars; `.env` readable only by the app user (`chmod 600`)
- [ ] HTTPS only; `NODE_ENV=production` (secure cookies on)
- [ ] App DB user is **not** a superuser (triggers protect audit/closed deals; a superuser could disable them)
- [ ] Worker running (`/tech` shows "worker last ran")
- [ ] First backup succeeded and a **test restore** done (below); copy backups off-server (S3/rsync) daily
- [ ] Founder, Aryan, Priya changed temporary passwords
- [ ] `SEED_DEMO` off / demo records purged
- [ ] `npm run test:rbac` passed on staging
- [ ] Uptime monitor on `GET /api/health` (returns 503 if DB is down)
- [ ] Optional: Nginx IP allow-list or VPN for `/admin` and `/tech`; `limit_req` on `/api/auth/login`

## Background worker (`scripts/worker.ts`)
Polls `jobs` every 30 s. Daily schedule (server local time): 02:00 backup · 03:00 full rescore (signal recency decays) · 04:00 expire quotes · 08:00 follow-up reminders · 19:00 founder summary · Monday 09:00 re-verification reminders. Failed jobs retry 3× with back-off, then show on `/tech` with a Retry button. Multiple workers are safe (`FOR UPDATE SKIP LOCKED`).

## Backups & restore
`pg_dump --format=custom` to `backup.dir` (Settings → Backups), pruned after `backup.retentionDays`. Manual: `npm run backup` or "Run backup now" on `/tech`.
```bash
createdb fivopay_crm_restore
pg_restore --no-owner -d fivopay_crm_restore backups/fivopay-crm-<timestamp>.dump
```

## Releases & rollback
```bash
git pull && npm ci && npm run db:migrate && npm run build && pm2 reload all
```
Schema changes: edit `src/db/schema.ts` → `npm run db:generate` → review the SQL in `drizzle/` → commit. Migrations are forward-only; to roll back, redeploy the previous tag and restore the pre-release backup (take one before every migration).

## Configuration ownership
| Who | What | Where |
|---|---|---|
| Founder (Super Admin) | Pricing, slabs, modules, scoring, stages, targets, company details, qualification questions, districts | `/catalogue`, `/admin/settings`, `/performance` |
| Aryan (Tech Admin) | AI provider/model, notifications, backups; dropdown lists (talukas, categories, activity types, lost reasons) | `/admin/settings` |
| Secrets (never in DB) | `JWT_SECRET`, `DATABASE_URL`, `ANTHROPIC_API_KEY`, `SMTP_*` | `.env` |

Aryan sees no business data by default. For debugging the Founder issues a time-boxed read-only grant on `/admin/grants`; everything viewed or exported under it is audited.

## Project layout
```
src/db/schema.ts        relational schema (single source of truth)
drizzle/                SQL migrations incl. 0001_hardening (triggers, pg_trgm)
src/lib/permissions.ts  permission catalogue + default roles
src/lib/auth.ts         sessions (JWT cookie + token version revocation)
src/lib/api.ts          API wrapper: auth, permission, same-origin, validation, error logging
src/lib/access.ts       row-level scoping (all / team / own)
src/lib/scoring.ts      lead scoring   src/lib/pricing.ts  pricing engine   src/lib/insights.ts  AI insights
src/app/(app)/…         pages          src/app/api/…        REST endpoints
scripts/                seed, migrate, worker, backup, test-rbac, purge-demo
```
