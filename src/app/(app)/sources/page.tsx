import Link from "next/link";
import { and, asc, desc, eq, isNotNull, lte, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { instScope } from "@/lib/access";
import { dt } from "@/lib/format";
import { Badge, Card, PageHeader, Stat, Table } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Sources() {
  const ctx = await requirePage("research.edit");
  const scope = instScope(ctx);
  const [due, recent, noSource, [stats]] = await Promise.all([
    db.select({ s: t.sources, inst: t.institutions.legalName }).from(t.sources).innerJoin(t.institutions, eq(t.institutions.id, t.sources.institutionId))
      .where(and(scope, lte(t.sources.nextVerificationAt, new Date()))).orderBy(asc(t.sources.nextVerificationAt)).limit(100),
    db.select({ s: t.sources, inst: t.institutions.legalName }).from(t.sources).innerJoin(t.institutions, eq(t.institutions.id, t.sources.institutionId))
      .where(scope).orderBy(desc(t.sources.createdAt)).limit(50),
    db.select({ id: t.institutions.id, name: t.institutions.legalName, score: t.institutions.score }).from(t.institutions)
      .where(and(scope, sql`not exists (select 1 from sources s where s.institution_id = ${t.institutions.id})`)).orderBy(desc(t.institutions.score)).limit(50),
    db.select({ total: sql<number>`count(*)::int`, verified: sql<number>`count(*) filter (where ${t.institutions.verification} = 'VERIFIED')::int`,
      partial: sql<number>`count(*) filter (where ${t.institutions.verification} = 'PARTIAL')::int`, dueInst: sql<number>`count(*) filter (where ${t.institutions.nextVerificationAt} <= now())::int` }).from(t.institutions).where(scope),
  ]);
  return (<>
    <PageHeader title="Research sources" sub="Evidence trail, verification queue and gaps." />
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Institutions" value={stats.total} href="/leads" /><Stat label="Verified" value={stats.verified} tone="good" href="/leads?verification=VERIFIED" />
      <Stat label="Partially verified" value={stats.partial} href="/leads?verification=PARTIAL" /><Stat label="Re-verification due" value={stats.dueInst} tone={stats.dueInst ? "warm" : undefined} />
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={`Sources due for re-verification (${due.length})`}>{due.map(({ s, inst }) => <div key={s.id} className="mb-1 text-sm"><Link className="link" href={`/leads/${s.institutionId}`}>{inst}</Link> — {s.name} <span className="text-xs text-red-600">due {dt(s.nextVerificationAt)}</span></div>)}{!due.length && <p className="muted">Nothing due.</p>}</Card>
      <Card title="Institutions without any source">{noSource.map((i) => <Link key={i.id} href={`/leads/${i.id}`} className="block text-sm hover:text-brand-600">{i.name}</Link>)}{!noSource.length && <p className="muted">Every institution has at least one source.</p>}</Card>
    </div>
    <div className="card mt-4"><Table head={["Source", "Institution", "Classification", "Verification", "Accessed", "Next check"]} empty={!recent.length}>
      {recent.map(({ s, inst }) => <tr key={s.id}><td className="td"><b>{s.name}</b>{s.url && <a className="link block max-w-xs truncate text-xs" href={s.url} target="_blank" rel="noreferrer">{s.url}</a>}</td>
        <td className="td"><Link className="link" href={`/leads/${s.institutionId}`}>{inst}</Link></td><td className="td"><Badge v={s.classification} /></td><td className="td"><Badge v={s.verification} /></td><td className="td text-xs">{dt(s.accessedAt)}</td><td className="td text-xs">{dt(s.nextVerificationAt)}</td></tr>)}
    </Table></div>
  </>);
}
