import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { dtt, inr } from "@/lib/format";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client/ActionButton";
export const dynamic = "force-dynamic";
export default async function Approvals() {
  const ctx = await requirePage("pricing.approve", "cr.approve");
  const rows = await db.query.approvalRequests.findMany({ with: { requestedBy: true }, orderBy: desc(t.approvalRequests.createdAt), limit: 100 });
  const pending = rows.filter((r) => r.status === "PENDING"), done = rows.filter((r) => r.status !== "PENDING");
  const link = (r: (typeof rows)[number]) => (r.entityType === "quote" ? `/quotes/${r.entityId}` : `/change-requests/${r.entityId}`);
  return (<>
    <PageHeader title="Approvals" sub="Discounts, below-floor pricing and sensitive change requests." />
    <Card title={`Pending (${pending.length})`} className="mb-4">
      {pending.map((r) => { const p = r.payload as any; return (
        <div key={r.id} className="mb-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2"><Badge v="PENDING">{r.type.replace(/_/g, " ")}</Badge><Link href={link(r)} className="link font-medium">{r.summary}</Link></div>
          <div className="mt-1 text-xs text-ink-500">Requested by {r.requestedBy.name} · {dtt(r.createdAt)}</div>
          {r.type === "DISCOUNT" && <div className="mt-1 text-xs">List {inr(p.monthlyList)}/mo → proposed {inr(p.monthlyAfterDiscount)}/mo (floor {inr(p.minAcceptable)}) · discount {p.discountPct}%{p.justification ? ` · “${p.justification}”` : ""}</div>}
          {(r.type === "CHANGE_REQUEST" ? ctx.can("cr.approve") : ctx.can("pricing.approve")) && <div className="mt-2 flex gap-2">
            <ActionButton url={`/api/approvals/${r.id}`} body={{ decision: "APPROVED" }} label="Approve" className="btn-primary" prompt="Note (optional)" />
            <ActionButton url={`/api/approvals/${r.id}`} body={{ decision: "REJECTED" }} label="Reject" className="btn-ghost" prompt="Reason" />
          </div>}
        </div>); })}
      {!pending.length && <Empty>Nothing waiting for you.</Empty>}
    </Card>
    <Card title="Recent decisions">{done.map((r) => <div key={r.id} className="flex flex-wrap items-center gap-2 border-b border-ink-100 py-1.5 text-sm"><Badge v={r.status} /><Link className="link" href={link(r)}>{r.summary}</Link><span className="text-xs text-ink-500">{dtt(r.decidedAt)}{r.decisionNote ? ` — ${r.decisionNote}` : ""}</span></div>)}</Card>
  </>);
}
