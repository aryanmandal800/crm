import Link from "next/link";
import { and, desc, eq, SQL } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { instScope } from "@/lib/access";
import { dt, inr } from "@/lib/format";
import { Badge, PageHeader, Table } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Quotes({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await requirePage("quote.create", "pricing.approve"); const sp = await searchParams;
  const conds: (SQL | undefined)[] = [instScope(ctx)]; if (sp.status) conds.push(eq(t.quotes.status, sp.status));
  const rows = await db.select({ q: t.quotes, inst: t.institutions.legalName, by: t.users.name }).from(t.quotes)
    .innerJoin(t.institutions, eq(t.institutions.id, t.quotes.institutionId)).innerJoin(t.users, eq(t.users.id, t.quotes.createdById)).where(and(...conds)).orderBy(desc(t.quotes.serial)).limit(300);
  return (<>
    <PageHeader title="Quotes & proposals" sub="Numbering continues the existing register (FP/CP/CLIENT/YYYY/NNN). Create a quote from an institution or deal." />
    <div className="mb-3 flex flex-wrap gap-2 text-sm">{["", "DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "ACCEPTED", "REJECTED"].map((s) => <Link key={s} href={s ? `/quotes?status=${s}` : "/quotes"} className={(sp.status ?? "") === s ? "btn-primary" : "btn-ghost"}>{s ? s.replace("_", " ").toLowerCase() : "all"}</Link>)}</div>
    <div className="card"><Table head={["Number", "Institution", "Monthly", "One-time", "Discount", "Status", "Created"]} empty={!rows.length}>
      {rows.map(({ q, inst, by }) => <tr key={q.id}><td className="td"><Link className="link font-medium" href={`/quotes/${q.id}`}>{q.number}</Link></td><td className="td">{inst}</td>
        <td className="td tabular-nums">{inr(q.monthlyFee * (1 - q.discountPct / 100))}</td><td className="td tabular-nums">{inr(q.implementationFee + q.migrationFee)}</td><td className="td">{q.discountPct}%</td>
        <td className="td"><Badge v={q.status} /></td><td className="td text-xs">{dt(q.createdAt)} · {by}</td></tr>)}
    </Table></div>
  </>);
}
