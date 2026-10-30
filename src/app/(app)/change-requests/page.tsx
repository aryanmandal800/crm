import Link from "next/link";
import { desc, eq, or } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { dt } from "@/lib/format";
import { Badge, Card, PageHeader, Table } from "@/components/ui";
import { JsonForm } from "@/components/client/JsonForm";
import { Disclosure } from "@/components/client/Disclosure";
export const dynamic = "force-dynamic";
export default async function ChangeRequests() {
  const ctx = await requirePage("cr.create", "cr.manage", "cr.approve");
  const seeAll = ctx.can("cr.manage") || ctx.can("cr.approve");
  const rows = await db.query.changeRequests.findMany({ where: seeAll ? undefined : eq(t.changeRequests.requestedById, ctx.user.id), with: { requestedBy: true, assignedTo: true }, orderBy: desc(t.changeRequests.createdAt) });
  return (<>
    <PageHeader title="Admin change request centre" sub="Routine changes (dropdowns, categories, pricing, scoring, stages, targets) are made directly in Settings — no developer needed. Use requests for development, data, security or infrastructure changes." />
    {ctx.can("cr.create") && <Card className="mb-4"><Disclosure label="Raise a change request" open={!rows.length}>
      <JsonForm action="/api/change-requests" redirectTo="/change-requests/{id}" fields={[
        { name: "title", label: "Title", required: true, wide: true },
        { name: "category", label: "Change category", type: "select", required: true, options: [["CONFIGURATION", "Configuration change"], ["DATA", "Data change"], ["DEVELOPMENT", "Development change"], ["SECURITY", "Security-sensitive change"], ["INFRASTRUCTURE", "Infrastructure change"]].map(([value, label]) => ({ value, label })) },
        { name: "priority", label: "Priority", type: "select", required: true, options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((v) => ({ value: v, label: v })) },
        { name: "description", label: "What needs to change", type: "textarea", required: true }, { name: "businessReason", label: "Business reason", type: "textarea" },
      ]} initial={{ category: "DEVELOPMENT", priority: "MEDIUM" }} submitLabel="Submit request" />
      <p className="mt-2 text-xs text-ink-500">Security and infrastructure changes — and anything touching permissions, roles, access, deletion or backups — always require Super Admin approval.</p>
    </Disclosure></Card>}
    <div className="card"><Table head={["ID", "Request", "Category", "Priority", "Status", "Approval", "Owner", "Raised"]} empty={!rows.length}>
      {rows.map((r) => <tr key={r.id}><td className="td font-mono text-xs">{r.code}</td><td className="td"><Link className="link" href={`/change-requests/${r.id}`}>{r.title}</Link></td>
        <td className="td text-xs">{r.category}</td><td className="td"><Badge v={r.priority === "CRITICAL" || r.priority === "HIGH" ? "HIGH" : r.priority}>{r.priority}</Badge></td>
        <td className="td"><Badge v={r.status === "COMPLETED" ? "COMPLETED" : r.status === "REJECTED" ? "REJECTED" : r.status === "APPROVAL_REQUIRED" ? "PENDING" : "IN_PROGRESS"}>{r.status.replace(/_/g, " ")}</Badge></td>
        <td className="td text-xs">{r.approvalStatus.replace(/_/g, " ").toLowerCase()}</td><td className="td text-sm">{r.assignedTo?.name ?? "—"}</td><td className="td text-xs">{dt(r.createdAt)} · {r.requestedBy.name}</td></tr>)}
    </Table></div>
  </>);
}
