import Link from "next/link";
import { and, desc, eq, gte, lte, SQL } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { activityScope } from "@/lib/access";
import { options } from "@/lib/options";
import { dtt, startOfDay, addDays } from "@/lib/format";
import { Badge, PageHeader, Table } from "@/components/ui";
import { ActionButton } from "@/components/client/ActionButton";

export const dynamic = "force-dynamic";
export default async function Activities({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requirePage("activity.create", "reports.view.all", "reports.view.team");
  const sp = await searchParams; const o = await options();
  const conds: (SQL | undefined)[] = [activityScope(ctx)];
  if (sp.user) conds.push(eq(t.activities.userId, sp.user));
  if (sp.type) conds.push(eq(t.activities.typeKey, sp.type));
  if (sp.status) conds.push(eq(t.activities.status, sp.status));
  if (sp.from) conds.push(gte(t.activities.occurredAt, new Date(sp.from)));
  if (sp.to) conds.push(lte(t.activities.occurredAt, addDays(new Date(sp.to), 1)));
  if (sp.range === "today") conds.push(gte(t.activities.occurredAt, startOfDay()));
  const rows = await db.select({ a: t.activities, user: t.users.name, inst: t.institutions.legalName, contact: t.contacts.name })
    .from(t.activities).innerJoin(t.users, eq(t.users.id, t.activities.userId)).innerJoin(t.institutions, eq(t.institutions.id, t.activities.institutionId))
    .leftJoin(t.contacts, eq(t.contacts.id, t.activities.contactId)).where(and(...conds)).orderBy(desc(t.activities.occurredAt)).limit(300);
  return (<>
    <PageHeader title="Sales activity tracker" sub="Timestamped history. Log new activities from an institution profile." actions={ctx.can("reports.export") ? <a href="/api/export/activities" className="btn-ghost">Export</a> : null} />
    <form className="card mb-4 grid gap-2 p-3 sm:grid-cols-6">
      <select name="user" defaultValue={sp.user ?? ""} className="input"><option value="">Everyone</option>{o.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
      <select name="type" defaultValue={sp.type ?? ""} className="input"><option value="">All types</option>{o.activityTypes.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}</select>
      <select name="status" defaultValue={sp.status ?? ""} className="input"><option value="">Any status</option><option value="DONE">Done</option><option value="PLANNED">Planned</option></select>
      <input type="date" name="from" defaultValue={sp.from} className="input" /><input type="date" name="to" defaultValue={sp.to} className="input" />
      <button className="btn-primary">Filter</button>
    </form>
    <div className="card"><Table head={["When", "Type", "Institution", "By", "Outcome", "Notes / next"]} empty={!rows.length}>
      {rows.map(({ a, user, inst, contact }) => (
        <tr key={a.id}><td className="td whitespace-nowrap text-xs">{dtt(a.occurredAt)}</td>
          <td className="td"><span className="text-sm">{o.activityTypes.find((x) => x.key === a.typeKey)?.name ?? a.typeKey}</span> {a.status !== "DONE" && <Badge v={a.status} />}</td>
          <td className="td"><Link className="link" href={`/leads/${a.institutionId}`}>{inst}</Link>{contact && <div className="text-xs text-ink-500">with {contact}</div>}</td>
          <td className="td text-sm">{user}</td>
          <td className="td">{a.outcome && <Badge v={a.outcome} />}{a.decisionMakerReached && <div><Badge v="VERIFIED">DM reached</Badge></div>}</td>
          <td className="td max-w-sm text-xs">{a.notes}{a.nextAction && <div className="text-brand-700">→ {a.nextAction}</div>}
            {a.status === "PLANNED" && a.userId === ctx.user.id && <div className="mt-1 flex gap-1"><ActionButton url={`/api/activities/${a.id}`} method="PATCH" body={{ status: "DONE" }} label="Mark done" prompt="Outcome notes (optional)" promptKey="notes" className="btn-ghost px-2 py-1 text-xs" /><ActionButton url={`/api/activities/${a.id}`} method="PATCH" body={{ status: "CANCELLED" }} label="Cancel" className="btn-ghost px-2 py-1 text-xs" /></div>}</td>
        </tr>))}
    </Table></div>
  </>);
}
