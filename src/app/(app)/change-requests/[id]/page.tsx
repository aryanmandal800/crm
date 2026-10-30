import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { options } from "@/lib/options";
import { dt, dtt } from "@/lib/format";
import { Badge, Card, Fact, PageHeader } from "@/components/ui";
import { JsonForm } from "@/components/client/JsonForm";
import { ActionButton } from "@/components/client/ActionButton";
export const dynamic = "force-dynamic";
export default async function CR({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage("cr.create", "cr.manage", "cr.approve"); const { id } = await params;
  const cr = await db.query.changeRequests.findFirst({ where: eq(t.changeRequests.id, id), with: { requestedBy: true, assignedTo: true } }); if (!cr) notFound();
  if (!ctx.can("cr.manage") && !ctx.can("cr.approve") && cr.requestedById !== ctx.user.id) notFound();
  const o = await options(); const tech = ctx.can("cr.manage") || ctx.can("cr.approve");
  const act = (action: string, label: string, extra: Record<string, any> = {}, cls = "btn-ghost") => <ActionButton url={`/api/change-requests/${id}`} body={{ action, ...extra }} label={label} prompt="Note" className={cls} />;
  return (<>
    <PageHeader title={`${cr.code} — ${cr.title}`} sub={<span className="flex flex-wrap gap-2"><Badge v="IN_PROGRESS">{cr.status.replace(/_/g, " ")}</Badge><span className="text-xs">{cr.category} · {cr.priority} · approval {cr.approvalStatus.toLowerCase().replace(/_/g, " ")}</span></span>} />
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card title="Request"><dl className="grid gap-3 sm:grid-cols-2"><Fact k="Requested by" v={`${cr.requestedBy.name} · ${dtt(cr.createdAt)}`} /><Fact k="Technical owner" v={cr.assignedTo?.name} />
          <div className="sm:col-span-2"><Fact k="Description" v={<span className="whitespace-pre-wrap">{cr.description}</span>} /></div>
          <div className="sm:col-span-2"><Fact k="Business reason" v={cr.businessReason} /></div>
          <div className="sm:col-span-2"><Fact k="Proposed solution" v={cr.proposedSolution && <span className="whitespace-pre-wrap">{cr.proposedSolution}</span>} /></div>
          <Fact k="Testing" v={cr.testingStatus.replace(/_/g, " ").toLowerCase()} /><Fact k="Completed" v={cr.completedAt ? dt(cr.completedAt) : null} />
          <div className="sm:col-span-2"><Fact k="Change notes" v={cr.changeNotes && <span className="whitespace-pre-wrap text-xs">{cr.changeNotes}</span>} /></div></dl></Card>
        {tech && cr.status === "REQUESTED" && <Card title="Review"><JsonForm action={`/api/change-requests/${id}`} extra={{ action: "review" }} cols={1} fields={[
          { name: "proposedSolution", label: "Proposed solution", type: "textarea", required: true },
          { name: "assignedToId", label: "Technical owner", type: "select", options: o.users.map((u) => ({ value: u.id, label: u.name })) },
          { name: "approvalRequired", label: "Requires Super Admin approval", type: "checkbox", help: cr.approvalRequired ? "Required by policy for this request." : undefined }, { name: "note", label: "Note", type: "textarea" }]}
          initial={{ assignedToId: ctx.user.id, approvalRequired: cr.approvalRequired }} submitLabel="Mark reviewed" /></Card>}
        {tech && <div className="flex flex-wrap gap-2">
          {cr.status === "REVIEWED" && act("start", "Start work", {}, "btn-primary")}
          {cr.status === "IN_PROGRESS" && <>{act("test", "Tests passed", { testingStatus: "PASSED" }, "btn-primary")}{act("test", "Tests failed", { testingStatus: "FAILED" })}</>}
          {cr.status === "TESTED" && act("complete", "Mark completed", {}, "btn-primary")}
          {["REQUESTED", "REVIEWED", "APPROVAL_REQUIRED", "IN_PROGRESS"].includes(cr.status) && act("reject", "Reject")}
          {cr.status === "APPROVAL_REQUIRED" && <span className="muted self-center">Waiting for Super Admin approval (Approvals page).</span>}
        </div>}
        {act("comment", "Add comment")}
      </div>
      <Card title="History"><ol className="space-y-2 text-sm">{[...cr.history].reverse().map((h, i) => <li key={i}><b>{h.action}</b> <span className="text-xs text-ink-500">{dtt(h.at)} · {h.by}</span>{h.note && <p className="text-xs">{h.note}</p>}</li>)}</ol></Card>
    </div>
  </>);
}
