import Link from "next/link";
import { and, asc, eq, or } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { options } from "@/lib/options";
import { dt } from "@/lib/format";
import { Badge, Card, PageHeader, Table } from "@/components/ui";
import { JsonForm } from "@/components/client/JsonForm";
import { ActionButton } from "@/components/client/ActionButton";
export const dynamic = "force-dynamic";
export default async function Tasks({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const ctx = await requirePage(); const sp = await searchParams; const o = await options();
  const showAll = sp.all === "1" && ctx.can("dashboard.founder");
  const rows = await db.query.tasks.findMany({ where: and(eq(t.tasks.status, "OPEN"), showAll ? undefined : or(eq(t.tasks.assigneeId, ctx.user.id), eq(t.tasks.createdById, ctx.user.id))), with: { assignee: true, institution: true }, orderBy: asc(t.tasks.dueAt) });
  const users = ctx.can("tasks.manage") ? o.users.filter((u) => ctx.scope === "ALL" || ctx.teamUserIds.includes(u.id)) : o.users.filter((u) => u.id === ctx.user.id);
  return (<>
    <PageHeader
      title="Tasks"
      sub="Internal to-dos. Deal follow-ups live on the deal itself."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn-primary text-xs" href="/work-tracker">
            Open Daily Tracker & EOD
          </Link>
          {ctx.can("dashboard.founder") ? (
            <Link className="btn-ghost text-xs" href={showAll ? "/tasks" : "/tasks?all=1"}>
              {showAll ? "My tasks" : "Everyone's tasks"}
            </Link>
          ) : null}
        </div>
      }
    />
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="card lg:col-span-2"><Table head={["Task", "Assignee", "Due", "Priority", ""]} empty={!rows.length}>
        {rows.map((x) => <tr key={x.id}><td className="td"><b>{x.title}</b>{x.institution && <div><Link className="link text-xs" href={`/leads/${x.institutionId}`}>{x.institution.legalName}</Link></div>}{x.description && <div className="text-xs text-ink-500">{x.description}</div>}</td>
          <td className="td text-sm">{x.assignee.name}</td><td className={`td text-xs ${x.dueAt && x.dueAt < new Date() ? "font-semibold text-red-600" : ""}`}>{dt(x.dueAt)}</td><td className="td"><Badge v={x.priority === "URGENT" || x.priority === "HIGH" ? "HIGH" : x.priority}>{x.priority}</Badge></td>
          <td className="td"><ActionButton url={`/api/tasks/${x.id}`} method="PATCH" body={{ status: "DONE" }} label="Done" className="btn-ghost px-2 py-1 text-xs" /></td></tr>)}
      </Table></div>
      <Card title="New task"><JsonForm action="/api/tasks" cols={1} fields={[
        { name: "title", label: "Task", required: true }, { name: "assigneeId", label: "Assign to", type: "select", options: users.map((u) => ({ value: u.id, label: u.name })) },
        { name: "dueAt", label: "Due", type: "date" }, { name: "priority", label: "Priority", type: "select", required: true, options: ["LOW", "MEDIUM", "HIGH", "URGENT"].map((v) => ({ value: v, label: v })) },
        { name: "description", label: "Details", type: "textarea" },
      ]} initial={{ priority: "MEDIUM", assigneeId: ctx.user.id }} submitLabel="Add task" /></Card>
    </div>
  </>);
}
