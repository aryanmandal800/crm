/**
 * Backend access-control test suite. Run against a running instance (dev or staging — NOT production data):
 *   TEST_BASE_URL=http://localhost:3000 npm run test:rbac
 * Creates throw-away users (rbac-*@test.local) and records tagged "rbactest", then disables/archives them.
 */
import bcrypt from "bcryptjs";
import { eq, inArray, sql } from "drizzle-orm";
import { db, pool, t } from "../src/db";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const PW = "RbacTest-2026x";
let pass = 0, fail = 0;
const results: string[] = [];

function check(name: string, ok: boolean, extra = "") { ok ? pass++ : fail++; results.push(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`); }

class Client {
  cookie = "";
  constructor(public label: string) {}
  async req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(BASE + path, { method, redirect: "manual", headers: { "content-type": "application/json", origin: BASE, cookie: this.cookie, ...headers }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.get("set-cookie"); if (set) this.cookie = set.split(";")[0];
    let json: any = null; try { json = await res.clone().json(); } catch {}
    return { status: res.status, json, location: res.headers.get("location") };
  }
  async login(email: string) { const r = await this.req("POST", "/api/auth/login", { email, password: PW }); if (r.status !== 200) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(r.json)}`); return this; }
}

async function mkUser(key: string, roleKey: string, teamId: string | null = null) {
  const email = `rbac-${key}@test.local`;
  const [role] = await db.select().from(t.roles).where(eq(t.roles.key, roleKey));
  const hash = await bcrypt.hash(PW, 10);
  const ex = await db.select().from(t.users).where(eq(t.users.email, email));
  if (ex.length) { await db.update(t.users).set({ roleId: role.id, teamId, active: true, mustChangePassword: false, passwordHash: hash, lockedUntil: null, failedLogins: 0 }).where(eq(t.users.id, ex[0].id)); return { ...ex[0], email }; }
  const [u] = await db.insert(t.users).values({ name: `RBAC ${key}`, email, roleId: role.id, teamId, passwordHash: hash, mustChangePassword: false }).returning();
  return u;
}

async function main() {
  const [team] = await db.insert(t.teams).values({ name: "RBAC Test Team" }).onConflictDoUpdate({ target: t.teams.name, set: { region: "test" } }).returning();
  const admin = await mkUser("admin", "SUPER_ADMIN"), tech = await mkUser("tech", "TECH_ADMIN"), mgr = await mkUser("mgr", "SALES_MANAGER", team.id);
  const exec = await mkUser("exec", "BDM", team.id), exec2 = await mkUser("exec2", "BDM"), analyst = await mkUser("analyst", "RESEARCH_ANALYST");
  await db.update(t.teams).set({ managerId: mgr.id }).where(eq(t.teams.id, team.id));
  await db.update(t.dataAccessGrants).set({ revokedAt: new Date() }).where(eq(t.dataAccessGrants.userId, tech.id));
  const [founder] = await db.select().from(t.users).where(eq(t.users.isFounder, true));

  const A = await new Client("admin").login(admin.email), T = await new Client("tech").login(tech.email), M = await new Client("mgr").login(mgr.email);
  const E = await new Client("exec").login(exec.email), E2 = await new Client("exec2").login(exec2.email), R = await new Client("analyst").login(analyst.email);
  const anon = new Client("anon");

  const [pune] = await db.select().from(t.districts).where(eq(t.districts.code, "PUN"));
  const [type] = await db.select().from(t.institutionTypes).where(eq(t.institutionTypes.key, "URBAN_PATSANSTHA"));
  const stages = Object.fromEntries((await db.select().from(t.pipelineStages)).map((s) => [s.key, s.id]));

  // ── authentication
  check("anonymous API write rejected (401)", (await anon.req("POST", "/api/leads", {})).status === 401);
  check("anonymous page redirected to login", (await anon.req("GET", "/leads")).status === 307);
  check("cross-origin write blocked (403)", (await A.req("POST", "/api/tasks", { title: "x y z" }, { origin: "https://evil.example" })).status === 403);

  // ── research analyst
  const created = await R.req("POST", "/api/leads", { legalName: `RBAC Test Society ${Date.now()}`, typeId: type.id, districtId: pune.id, tags: ["rbactest"], force: true });
  check("analyst can create institution", created.status === 200 && !!created.json?.id, `${created.status}`);
  const instId = created.json?.id as string;
  await db.update(t.institutions).set({ tags: ["rbactest"] }).where(eq(t.institutions.id, instId));
  check("analyst can add source", (await R.req("POST", `/api/leads/${instId}/sources`, { name: "Test registrar record", url: "https://example.org/x", fieldKeys: ["legalName"] })).status === 200);
  check("analyst cannot see pricing (403)", (await R.req("POST", "/api/pricing/calc", { members: 1000, branches: 1 })).status === 403);
  check("analyst cannot create deal (403)", (await R.req("POST", "/api/deals", { institutionId: instId, title: "x y z", stageId: stages.NEW, opportunityCategory: "GREENFIELD_CBS", nextAction: "call", followUpDate: new Date().toISOString() })).status === 403);

  // ── assignment & scope
  check("manager cannot assign outside team (403)", (await M.req("POST", "/api/leads/assign", { ids: [instId], ownerId: exec2.id })).status === 403);
  check("manager can assign to team member", (await M.req("POST", "/api/leads/assign", { ids: [instId], ownerId: exec.id })).status === 200);
  check("exec cannot assign (403)", (await E.req("POST", "/api/leads/assign", { ids: [instId], ownerId: exec.id })).status === 403);
  check("other exec cannot see the lead (404)", (await E2.req("POST", `/api/leads/${instId}/rescore`)).status === 404 || (await E2.req("PATCH", `/api/leads/${instId}`, { landline: "020" })).status === 404);
  check("owner exec can update contact details", (await E.req("PATCH", `/api/leads/${instId}`, { landline: "020-0000000" })).status === 200);
  check("exec cannot edit research fields (403)", (await E.req("PATCH", `/api/leads/${instId}`, { totalMembers: 999999 })).status === 403);
  check("exec cannot archive (403)", (await E.req("DELETE", `/api/leads/${instId}`)).status === 403);

  // ── deals & locked financials
  const deal = await E.req("POST", "/api/deals", { institutionId: instId, title: "RBAC deal", stageId: stages.QUALIFIED, opportunityCategory: "GREENFIELD_CBS", nextAction: "Demo", followUpDate: new Date(Date.now() + 864e5).toISOString(), mrr: 10000 });
  check("exec can create deal on own lead", deal.status === 200, `${deal.status} ${JSON.stringify(deal.json)}`);
  const dealId = deal.json?.id;
  check("open deal without follow-up rejected (400)", (await E.req("PATCH", `/api/deals/${dealId}`, { followUpDate: null })).status === 400);
  check("lost without reason rejected (400)", (await E.req("PATCH", `/api/deals/${dealId}`, { stageId: stages.LOST })).status === 400);
  check("exec can mark won", (await E.req("PATCH", `/api/deals/${dealId}`, { stageId: stages.WON })).status === 200);
  check("exec cannot change won deal MRR (403)", (await E.req("PATCH", `/api/deals/${dealId}`, { mrr: 1 })).status === 403);
  check("manager cannot change won deal MRR (403)", (await M.req("PATCH", `/api/deals/${dealId}`, { mrr: 1 })).status === 403);
  check("super admin can correct won deal MRR", (await A.req("PATCH", `/api/deals/${dealId}`, { mrr: 12000 })).status === 200);
  let dbBlocked = false; try { await db.update(t.deals).set({ mrr: 5 }).where(eq(t.deals.id, dealId)); } catch { dbBlocked = true; }
  check("database trigger blocks direct edit of locked deal", dbBlocked);
  check("onboarding auto-created on win", (await db.select().from(t.onboardings).where(eq(t.onboardings.dealId, dealId))).length === 1);

  // ── pricing approvals
  const q = await E.req("POST", "/api/quotes", { institutionId: instId, members: 10000, branches: 3, discountPct: 40 });
  check("deep discount quote goes to approval", q.status === 200 && q.json?.needsApproval === true, JSON.stringify(q.json));
  check("exec cannot send quote (403)", (await E.req("POST", `/api/quotes/${q.json?.id}/status`, { action: "send" })).status === 403);
  const [appr] = await db.select().from(t.approvalRequests).where(eq(t.approvalRequests.entityId, q.json?.id));
  check("exec cannot approve (403)", (await E.req("POST", `/api/approvals/${appr.id}`, { decision: "APPROVED" })).status === 403);
  check("tech admin cannot approve (403)", (await T.req("POST", `/api/approvals/${appr.id}`, { decision: "APPROVED" })).status === 403);
  check("super admin approves", (await A.req("POST", `/api/approvals/${appr.id}`, { decision: "APPROVED" })).status === 200);
  check("manager can send approved quote", (await M.req("POST", `/api/quotes/${q.json?.id}/status`, { action: "send" })).status === 200);
  const pdf = await fetch(`${BASE}/api/quotes/${q.json?.id}/pdf`, { headers: { cookie: A.cookie } });
  check("quote PDF renders", pdf.status === 200 && (pdf.headers.get("content-type") ?? "").includes("pdf"));

  // ── technical administrator separation
  check("tech admin: no business data via export (403)", (await T.req("GET", "/api/export/leads")).status === 403);
  check("tech admin: lead page forbidden", (await T.req("GET", `/leads/${instId}`)).location?.includes("/forbidden") ?? false);
  check("tech admin cannot change pricing (403)", (await T.req("PATCH", "/api/settings", { "pricing.floorRate": 1 })).status === 403);
  check("tech admin can change AI setting", (await T.req("PATCH", "/api/settings", { "ai.maxTokens": 1500 })).status === 200);
  check("tech admin cannot create users (403)", (await T.req("POST", "/api/users", { name: "Evil", email: "evil@test.local", roleId: admin.roleId })).status === 403);
  check("tech admin cannot edit founder (403)", (await T.req("PATCH", `/api/users/${founder.id}`, { active: false })).status === 403);
  check("tech admin cannot reset founder password (403)", (await T.req("POST", `/api/users/${founder.id}/reset`)).status === 403);
  check("tech admin cannot reset super admin (403)", (await T.req("POST", `/api/users/${admin.id}/reset`)).status === 403);
  check("tech admin cannot edit roles (403)", (await T.req("PATCH", `/api/roles/${tech.roleId}`, { permissions: ["lead.view.all"] })).status === 403);
  check("tech admin cannot edit pipeline stages (403)", (await T.req("PATCH", `/api/taxonomy/stages/${stages.DEMO}`, { probability: 99 })).status === 403);
  check("tech admin can maintain dropdowns", (await T.req("PATCH", `/api/taxonomy/lostReasons/${(await db.select().from(t.lostReasons))[0].id}`, { active: true })).status === 200);
  let auditBlocked = false; try { await db.execute(sql`delete from audit_logs where id = (select min(id) from audit_logs)`); } catch { auditBlocked = true; }
  check("audit log cannot be deleted (DB trigger)", auditBlocked);

  // ── break-glass grant
  const g = await A.req("POST", "/api/grants", { userId: tech.id, hours: 1, scope: "READ", reason: "RBAC test — verify read-only grant" });
  check("super admin grants read-only access", g.status === 200);
  check("granted tech admin can read lead page", (await T.req("GET", `/leads/${instId}`)).status === 200);
  check("READ grant still cannot export (403)", (await T.req("GET", "/api/export/leads")).status === 403);
  check("grant is read-only: writes rejected (403)", (await T.req("PATCH", `/api/leads/${instId}`, { notes: "x" })).status === 403);
  await A.req("DELETE", `/api/grants/${g.json?.id}`);
  check("revoked grant removes access", (await T.req("GET", `/leads/${instId}`)).location?.includes("/forbidden") ?? false);

  // ── super admin hierarchy
  check("non-founder super admin cannot disable founder (403)", (await A.req("PATCH", `/api/users/${founder.id}`, { active: false })).status === 403);
  check("non-founder super admin cannot create super admin (403)", (await A.req("POST", "/api/users", { name: "Second Admin", email: `sa-${Date.now()}@test.local`, roleId: admin.roleId })).status === 403);
  check("reserved permission cannot be granted to another role (403)", (await A.req("PATCH", `/api/roles/${mgr.roleId}`, { permissions: ["pricing.approve"] })).status === 403);
  check("disabled user is signed out immediately", await (async () => { await A.req("PATCH", `/api/users/${exec2.id}`, { active: false }); return (await E2.req("POST", "/api/tasks", { title: "should fail" })).status === 401; })());

  // ── cleanup (records stay archived; audit history is permanent)
  await db.update(t.institutions).set({ deletedAt: new Date() }).where(sql`'rbactest' = any(${t.institutions.tags})`);
  await db.update(t.users).set({ active: false }).where(inArray(t.users.email, [admin, tech, mgr, exec, exec2, analyst].map((u) => u.email)));

  console.log(results.join("\n"));
  console.log(`\n${pass} passed, ${fail} failed`);
  await pool.end();
  process.exit(fail ? 1 : 0);
}
main().catch(async (e) => { console.error(e); console.log(results.join("\n")); await pool.end(); process.exit(1); });
