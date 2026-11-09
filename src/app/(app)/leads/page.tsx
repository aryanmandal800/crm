import Link from "next/link";
import { and, asc, desc, eq, ilike, or, sql, SQL } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { instScope } from "@/lib/access";
import { assignable, options } from "@/lib/options";
import { PageHeader } from "@/components/ui";
import { LeadTable } from "@/components/client/LeadTable";
import { OPPORTUNITY_CATEGORIES } from "@/lib/scoring";

export const dynamic = "force-dynamic";
const PAGE = 50;

export default async function Leads({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requirePage("lead.view.all", "lead.view.team", "lead.view.own");
  const sp = await searchParams;
  const o = await options();
  const conds: (SQL | undefined)[] = [instScope(ctx)];
  if (sp.q) conds.push(or(ilike(t.institutions.legalName, `%${sp.q}%`), ilike(t.institutions.shortName, `%${sp.q}%`), ilike(t.institutions.leadCode, `%${sp.q}%`), ilike(t.institutions.regNumber, `%${sp.q}%`), ilike(t.institutions.city, `%${sp.q}%`)));
  if (sp.taluka) conds.push(eq(t.institutions.talukaId, sp.taluka));
  if (sp.type) conds.push(eq(t.institutions.typeId, sp.type));
  if (sp.band) conds.push(eq(t.institutions.scoreBand, sp.band));
  if (sp.category) conds.push(eq(t.institutions.opportunityCategory, sp.category));
  if (sp.verification) conds.push(eq(t.institutions.verification, sp.verification as any));
  if (sp.owner === "me") conds.push(eq(t.institutions.ownerId, ctx.user.id));
  else if (sp.owner === "none") conds.push(sql`${t.institutions.ownerId} is null`);
  else if (sp.owner) conds.push(eq(t.institutions.ownerId, sp.owner));
  if (sp.segment === "primary") conds.push(sql`${t.institutionTypes.isPrimary}`);
  if (sp.segment === "expansion") conds.push(sql`not ${t.institutionTypes.isPrimary}`);
  if (sp.vendor) conds.push(eq(t.institutions.vendorClass, sp.vendor as any));
  if (sp.tag) conds.push(sql`${sp.tag} = any(${t.institutions.tags})`);
  const where = and(...conds);
  const sort =
    sp.sort === "score"
      ? desc(t.institutions.score)
      : sp.sort === "name"
      ? asc(t.institutions.legalName)
      : sp.sort === "members"
      ? sql`${t.institutions.totalMembers} desc nulls last`
      : sp.sort === "oldest"
      ? asc(t.institutions.createdAt)
      : desc(t.institutions.createdAt);
  const page = Math.max(1, Number(sp.page ?? 1));

  const base = db.select({
    id: t.institutions.id, leadCode: t.institutions.leadCode, legalName: t.institutions.legalName, city: t.institutions.city,
    type: t.institutionTypes.name, taluka: t.talukas.name, owner: t.users.name, score: t.institutions.score, band: t.institutions.scoreBand,
    members: t.institutions.totalMembers, branches: t.institutions.branchCount, verification: t.institutions.verification,
    category: t.institutions.opportunityCategory, vendor: t.institutions.cbsVendor, createdAt: t.institutions.createdAt,
  }).from(t.institutions).innerJoin(t.institutionTypes, eq(t.institutionTypes.id, t.institutions.typeId))
    .leftJoin(t.talukas, eq(t.talukas.id, t.institutions.talukaId)).leftJoin(t.users, eq(t.users.id, t.institutions.ownerId));
  const [rows, [{ n }]] = await Promise.all([
    base.where(where).orderBy(sort, desc(t.institutions.createdAt)).limit(PAGE).offset((page - 1) * PAGE),
    db.select({ n: sql<number>`count(*)::int` }).from(t.institutions).innerJoin(t.institutionTypes, eq(t.institutionTypes.id, t.institutions.typeId)).where(where),
  ]);
  const qs = (patch: Record<string, string | undefined>) => "?" + new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]).toString();
  const sel = (name: string, label: string, opts: { value: string; label: string }[]) => (
    <select name={name} defaultValue={sp[name] ?? ""} className="input"><option value="">{label}</option>{opts.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select>
  );

  return (<>
    <PageHeader title="Lead database" sub={`${n.toLocaleString("en-IN")} institutions in your view`} actions={<>
      {ctx.can("lead.import") && <Link href="/leads/import" className="btn-ghost">Bulk import</Link>}
      {ctx.can("reports.export") && <a href={`/api/export/leads${qs({})}`} className="btn-ghost">Export Excel</a>}
      {ctx.can("lead.create") && <Link href="/leads/new" className="btn-primary">Add institution</Link>}
    </>} />
    <form className="card mb-4 grid gap-2 p-3 sm:grid-cols-3 lg:grid-cols-6">
      <input name="q" defaultValue={sp.q} placeholder="Search name, code, reg no, city" className="input sm:col-span-2" />
      {sel("taluka", "All talukas", o.talukas.map((x) => ({ value: x.id, label: x.name })))}
      {sel("type", "All types", o.types.map((x) => ({ value: x.id, label: x.name })))}
      {sel("band", "All bands", ["HOT", "WARM", "NURTURE", "LOW"].map((x) => ({ value: x, label: x })))}
      {sel("category", "All opportunities", Object.entries(OPPORTUNITY_CATEGORIES).map(([value, label]) => ({ value, label })))}
      {sel("verification", "Any verification", ["UNVERIFIED", "PARTIAL", "VERIFIED", "DISPUTED"].map((x) => ({ value: x, label: x })))}
      {sel("owner", "Any owner", [{ value: "me", label: "Me" }, { value: "none", label: "Unassigned" }, ...o.users.map((u) => ({ value: u.id, label: u.name }))])}
      {sel("segment", "All segments", [{ value: "primary", label: "Primary credit societies" }, { value: "expansion", label: "Expansion categories" }])}
      {sel("vendor", "Any vendor status", ["CONFIRMED_INCUMBENT", "PROBABLE_INCUMBENT", "UNKNOWN", "NONE_IDENTIFIED"].map((x) => ({ value: x, label: x.replace(/_/g, " ").toLowerCase() })))}
      {sel("sort", "Sort: Latest added", [
        { value: "score", label: "Sort: Lead score" },
        { value: "name", label: "Sort: Name (A-Z)" },
        { value: "members", label: "Sort: Members" },
        { value: "oldest", label: "Sort: Oldest added" },
      ])}
      <div className="flex gap-2"><button className="btn-primary flex-1">Filter</button><Link href="/leads" className="btn-ghost">Reset</Link></div>
    </form>
    <LeadTable
      rows={rows}
      startIndex={(page - 1) * PAGE}
      canAssign={ctx.can("lead.assign")}
      assignees={assignable(ctx, o.users).map((u) => ({ value: u.id, label: u.name }))}
    />
    <div className="mt-3 flex items-center justify-between text-sm">
      <span className="text-ink-500">Page {page} of {Math.max(1, Math.ceil(n / PAGE))}</span>
      <div className="flex gap-2">
        {page > 1 && <Link className="btn-ghost" href={qs({ page: String(page - 1) })}>Previous</Link>}
        {page * PAGE < n && <Link className="btn-ghost" href={qs({ page: String(page + 1) })}>Next</Link>}
      </div>
    </div>
  </>);
}
