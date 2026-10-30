import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { getInstitutionOr404 } from "@/lib/access";
import { dt, inr } from "@/lib/format";
import { Badge, Card, Fact, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client/ActionButton";
export const dynamic = "force-dynamic";
export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage("quote.create", "pricing.approve"); const { id } = await params;
  const q = await db.query.quotes.findFirst({ where: eq(t.quotes.id, id), with: { institution: true, createdBy: true } }); if (!q) notFound();
  if (!(await getInstitutionOr404(ctx, q.institutionId).catch(() => null))) notFound();
  const [appr] = await db.select().from(t.approvalRequests).where(eq(t.approvalRequests.entityId, id));
  const net = q.monthlyFee * (1 - q.discountPct / 100); const once = q.implementationFee + q.migrationFee;
  const canSend = (ctx.can("quote.send") || ctx.can("pricing.approve")) && ["DRAFT", "APPROVED"].includes(q.status);
  return (<>
    <PageHeader title={q.number} sub={<span className="flex items-center gap-2"><Link className="link" href={`/leads/${q.institutionId}`}>{q.institution.legalName}</Link><Badge v={q.status} /></span>} actions={<>
      <a href={`/api/quotes/${id}/pdf`} target="_blank" className="btn-primary">PDF</a>
      {canSend && <ActionButton url={`/api/quotes/${id}/status`} body={{ action: "send" }} label="Mark sent" />}
      {q.status === "SENT" && <><ActionButton url={`/api/quotes/${id}/status`} body={{ action: "accept" }} label="Accepted" /><ActionButton url={`/api/quotes/${id}/status`} body={{ action: "reject" }} label="Rejected" /></>}
      {["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(q.status) && <ActionButton url={`/api/quotes/${id}/status`} body={{ action: "cancel" }} label="Cancel" confirm="Cancel this quote? The number stays in the register." />}
    </>} />
    {appr && <Card title="Pricing approval" className="mb-4"><div className="flex flex-wrap items-center gap-2 text-sm"><Badge v={appr.status} /><span>{appr.summary}</span>{appr.decisionNote && <span className="text-ink-500">— {appr.decisionNote}</span>}{appr.status === "PENDING" && ctx.can("pricing.approve") && <Link href="/approvals" className="link">Decide →</Link>}</div></Card>}
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Lines" className="lg:col-span-2">
        {q.lines.map((l) => <div key={l.key} className="flex justify-between border-b border-ink-100 py-1 text-sm"><span>{l.name}{l.kind === "ONE_TIME" ? " (one-time)" : " / month"}</span><span className="tabular-nums">{inr(l.amount)}</span></div>)}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"><Fact k="Monthly net" v={inr(net)} /><Fact k="One-time" v={inr(once)} /><Fact k="Discount" v={`${q.discountPct}%`} /><Fact k={`GST ${q.gstRate}%`} v="Extra" /></div>
        {q.scope && <p className="mt-3 text-sm"><b>Scope:</b> {q.scope}</p>}
        <p className="mt-3 whitespace-pre-wrap text-xs text-ink-700">{q.terms}</p>
      </Card>
      <Card title="Details"><dl className="space-y-2"><Fact k="Model" v={q.model} /><Fact k="Members / branches" v={`${q.members.toLocaleString("en-IN")} / ${q.branches}`} /><Fact k="Valid until" v={dt(q.validUntil)} />
        <Fact k="Prepared by" v={q.createdBy.name} /><Fact k="Milestones" v={q.milestones.map((m) => `${m.name} ${m.pct}%`).join(", ")} /></dl></Card>
    </div>
  </>);
}
