import { and, desc, eq, ilike, inArray, SQL } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { TECHNICAL_AUDIT_ENTITIES } from "@/lib/audit";
import { dtt } from "@/lib/format";
import { PageHeader, Table } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Audit({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requirePage("audit.view", "audit.view.technical"); const sp = await searchParams;
  const conds: (SQL | undefined)[] = [];
  if (!ctx.can("audit.view")) conds.push(inArray(t.auditLogs.entityType, TECHNICAL_AUDIT_ENTITIES));
  if (sp.entity) conds.push(eq(t.auditLogs.entityType, sp.entity));
  if (sp.actor) conds.push(ilike(t.auditLogs.actorName, `%${sp.actor}%`));
  if (sp.action) conds.push(ilike(t.auditLogs.action, `%${sp.action}%`));
  const rows = await db.select().from(t.auditLogs).where(and(...conds)).orderBy(desc(t.auditLogs.id)).limit(300);
  return (<>
    <PageHeader title="Audit log" sub={`Append-only — the database rejects edits and deletions.${ctx.can("audit.view") ? "" : " Showing configuration, user and permission entries only."}`} />
    <form className="card mb-4 grid gap-2 p-3 sm:grid-cols-4"><input name="entity" placeholder="Entity (deal, institution, setting…)" defaultValue={sp.entity} className="input" /><input name="actor" placeholder="Actor" defaultValue={sp.actor} className="input" /><input name="action" placeholder="Action" defaultValue={sp.action} className="input" /><button className="btn-primary">Filter</button></form>
    <div className="card"><Table head={["When", "Actor", "Action", "Entity", "Change"]} empty={!rows.length}>
      {rows.map((r) => <tr key={r.id}><td className="td whitespace-nowrap text-xs">{dtt(r.at)}</td><td className="td text-xs">{r.actorName}<div className="text-ink-500">{r.actorRole}{r.ip ? ` · ${r.ip}` : ""}</div></td>
        <td className="td text-xs font-medium">{r.action}</td><td className="td text-xs">{r.entityType}<div className="max-w-[10rem] truncate text-ink-500">{r.entityId}</div></td>
        <td className="td"><pre className="max-h-32 max-w-xl overflow-auto whitespace-pre-wrap text-[11px] text-ink-700">{r.before ? `before: ${JSON.stringify(r.before)}\n` : ""}{r.after ? JSON.stringify(r.after) : ""}</pre></td></tr>)}
    </Table></div>
  </>);
}
