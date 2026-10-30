import Link from "next/link";
import { and, desc, eq, ilike, or, SQL } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { instScope } from "@/lib/access";
import { dt, label } from "@/lib/format";
import { Badge, PageHeader, Table } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function DecisionMakers({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requirePage("lead.view.all", "lead.view.team", "lead.view.own");
  const sp = await searchParams;
  const conds: (SQL | undefined)[] = [instScope(ctx)];
  if (sp.q) conds.push(or(ilike(t.contacts.name, `%${sp.q}%`), ilike(t.institutions.legalName, `%${sp.q}%`)));
  if (sp.role) conds.push(eq(t.contacts.role, sp.role as any));
  if (sp.dm === "1") conds.push(eq(t.contacts.isDecisionMaker, true));
  const rows = await db.select({ c: t.contacts, inst: t.institutions.legalName }).from(t.contacts).innerJoin(t.institutions, eq(t.institutions.id, t.contacts.institutionId))
    .where(and(...conds)).orderBy(desc(t.contacts.relationshipStrength)).limit(500);
  return (<>
    <PageHeader title="Decision-maker CRM" sub="Public business contact details only. Add or edit from the institution profile." />
    <form className="card mb-4 grid gap-2 p-3 sm:grid-cols-4">
      <input name="q" defaultValue={sp.q} placeholder="Search name or institution" className="input sm:col-span-2" />
      <select name="role" defaultValue={sp.role ?? ""} className="input"><option value="">All roles</option>{["CHAIRMAN", "VICE_CHAIRMAN", "SECRETARY", "CEO_MD", "GENERAL_MANAGER", "IT_MANAGER", "FINANCE_HEAD", "DIRECTOR", "INFLUENCER", "OTHER"].map((r) => <option key={r} value={r}>{label(r)}</option>)}</select>
      <div className="flex gap-2"><label className="flex items-center gap-1 text-sm"><input type="checkbox" name="dm" value="1" defaultChecked={sp.dm === "1"} />DMs only</label><button className="btn-primary flex-1">Filter</button></div>
    </form>
    <div className="card"><Table head={["Name", "Institution", "Role", "Flags", "Relationship", "Verification", "Last met"]} empty={!rows.length}>
      {rows.map(({ c, inst }) => <tr key={c.id}><td className="td"><b>{c.name}</b><div className="text-xs text-ink-500">{c.businessPhone} {c.businessEmail}</div></td>
        <td className="td"><Link className="link" href={`/leads/${c.institutionId}`}>{inst}</Link></td><td className="td text-xs">{c.designation ?? label(c.role)}</td>
        <td className="td space-x-1">{c.isFinalApprover && <Badge v="APPROVED">Approver</Badge>}{c.isDecisionMaker && <Badge v="HIGH">DM</Badge>}{c.isChampion && <Badge v="SUCCESS">Champion</Badge>}{c.isInfluencer && <Badge v="MEDIUM">Influencer</Badge>}</td>
        <td className="td">{"●".repeat(c.relationshipStrength)}<span className="text-ink-300">{"●".repeat(5 - c.relationshipStrength)}</span></td><td className="td"><Badge v={c.verification} /></td><td className="td text-xs">{dt(c.lastMetAt)}</td></tr>)}
    </Table></div>
  </>);
}
