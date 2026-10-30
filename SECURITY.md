# Security & access control

## Controls
- **Authorisation on the server, every request.** Each API route declares the permissions it needs (`api([...])`); each page calls `requirePage(...)`. Rows are filtered by scope (all / team / own) in SQL, so hidden buttons are never the control.
- **Sessions:** HS256 JWT in an httpOnly, SameSite=Lax, Secure cookie; user + role re-loaded per request. Disabling a user, changing their role or resetting their password bumps `token_version` and ends every session immediately.
- **Passwords:** bcrypt (cost 12), min 10 chars with letters + digits, forced change on first login, 5 failures → 15-minute lock, uniform error messages.
- **CSRF:** SameSite cookie + Origin check on every non-GET request.
- **Headers:** CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy.
- **Input:** Zod validation on every write; Drizzle parameterised queries; CSV export neutralises formula injection.
- **Database-level guards:** audit log append-only (trigger); won-deal financials and stage locked unless the transaction is explicitly unlocked by the Super Admin code path; closed deals cannot be deleted.
- **Audit:** logins (incl. failures), every create/update, approvals, exports, PDF downloads, settings and permission changes — with before/after and IP. Secrets are redacted.
- **Secrets** only in environment variables; the API key for the LLM is never stored in the database.

## Role matrix (defaults — editable by the Founder except reserved permissions)
| Capability | Super Admin | Tech Admin | Sales Mgr | Sales Exec | Research |
|---|:-:|:-:|:-:|:-:|:-:|
| See institutions | all | — (grant only) | team + unassigned | own | all |
| Edit research fields / sources / signals | ✓ | — | ✓ | — | ✓ |
| Edit contact details | ✓ | — | ✓ | own | ✓ |
| Assign leads | ✓ | — | within team | — | — |
| Deals, activities | ✓ | — | team | own | — |
| See pricing / draft quotes | ✓ | — | ✓ | ✓ | — |
| Send quotes | ✓ | — | ✓ | — | — |
| Approve discounts / pricing exceptions | ✓ | — | — | — | — |
| Edit won-deal financials | ✓ | — | — | — | — |
| Export data | ✓ | grant only | — | — | — |
| Business rules (pricing, scoring, stages, targets) | ✓ | — | — | — | — |
| Technical settings, dropdown lists, tech dashboard | ✓ | ✓ | — | — | — |
| Users & roles | ✓ | reset non-admin passwords | — | — | — |
| Audit log | full | config/user/permission entries | — | — | — |
| Approve sensitive change requests | ✓ | — | — | — | — |

**Reserved for Super Admin** (cannot be given to any other role): approve pricing, edit locked deals, manage users/roles, full audit, data-access grants, approve change requests, founder dashboard, district expansion.

**Founder account:** cannot be edited, disabled, demoted or reset by anyone else — including other Super Admins — and the Founder cannot lock themself out. Only the Founder can create another Super Admin.

## Known gaps / recommended next steps
- No MFA yet — recommended for Super Admin and Tech Admin (TOTP), or restrict `/admin` and `/tech` by IP/VPN at Nginx.
- Login throttling is per account; add Nginx `limit_req` for per-IP throttling.
- Run behind HTTPS only; the app sets `Secure` cookies when `NODE_ENV=production`.
