import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { instScope } from "@/lib/access";
import { dt, inr } from "@/lib/format";
import { Badge, PageHeader, Table } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Onboarding() {
  const ctx = await requirePage("onboarding.view");
  const rows = await db.select({ o: t.onboardings, inst: t.institutions.legalName, owner: t.users.name }).from(t.onboardings).innerJoin(t.institutions, eq(t.institutions.id, t.onboardings.institutionId))
    .leftJoin(t.users, eq(t.users.id, t.onboardings.ownerId)).where(and(instScope(ctx))).orderBy(desc(t.onboardings.createdAt));
  return (<>
    <PageHeader title="Customer onboarding" sub="Created automatically when a deal is marked Won." />
    <div className="card"><Table head={["Customer", "Status", "Progress", "Owner", "Contract value", "Outstanding", "Go-live"]} empty={!rows.length}>
      {rows.map(({ o, inst, owner }) => { const done = o.steps.filter((s) => s.status === "DONE").length; return (
        <tr key={o.id}><td className="td"><Link className="link font-medium" href={`/onboarding/${o.id}`}>{inst}</Link></td><td className="td"><Badge v={o.status === "LIVE" ? "SUCCESS" : o.status} >{o.status}</Badge></td>
          <td className="td"><div className="h-2 w-28 rounded bg-ink-100"><div className="h-2 rounded bg-emerald-500" style={{ width: `${(done / o.steps.length) * 100}%` }} /></div><span className="text-xs text-ink-500">{done}/{o.steps.length}</span></td>
          <td className="td">{owner ?? "—"}</td><td className="td">{inr(o.contractValue)}</td><td className="td">{inr(o.outstandingAmount)}</td><td className="td text-xs">{dt(o.goLiveDate)}</td></tr>); })}
    </Table></div>
  </>);
}
