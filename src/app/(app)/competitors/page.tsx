import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { Badge, Card, PageHeader, Table } from "@/components/ui";
import { JsonForm } from "@/components/client/JsonForm";
import { Disclosure } from "@/components/client/Disclosure";
import { competitorFields } from "@/lib/competitorFields";
export const dynamic = "force-dynamic";
export default async function Competitors() {
  const ctx = await requirePage("competitor.view");
  const rows = await db.select({ c: t.competitors, src: sql<number>`(select count(*) from sources s where s.competitor_id = ${t.competitors.id})::int`,
    inst: sql<number>`(select count(*) from institutions i where i.deleted_at is null and lower(i.cbs_vendor) = lower(${t.competitors.name}))::int`,
    lost: sql<number>`(select count(*) from deals d where d.competitor_id = ${t.competitors.id})::int` }).from(t.competitors).orderBy(asc(t.competitors.name));
  return (<>
    <PageHeader title="Competitor intelligence" sub="Cooperative CBS and technology vendors. Record only evidence-backed claims, each with a source." />
    <div className="card mb-4"><Table head={["Vendor", "Product", "Segment", "Incumbent at", "Deals involved", "Sources", "Verification"]} empty={!rows.length}>
      {rows.map(({ c, src, inst, lost }) => <tr key={c.id}><td className="td"><Link className="link font-medium" href={`/competitors/${c.id}`}>{c.name}</Link></td><td className="td">{c.product ?? "—"}</td>
        <td className="td text-xs">{c.targetSegment ?? "—"}</td><td className="td">{inst}</td><td className="td">{lost}</td><td className="td">{src}</td><td className="td"><Badge v={c.verification} /></td></tr>)}
    </Table></div>
    {ctx.can("competitor.edit") && !ctx.grant && <Card><Disclosure label="Add vendor" open={!rows.length}><JsonForm action="/api/competitors" fields={competitorFields} redirectTo="/competitors/{id}" initial={{ verification: "UNVERIFIED" }} /></Disclosure></Card>}
  </>);
}
