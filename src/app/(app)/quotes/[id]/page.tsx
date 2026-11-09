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
  const setupDisc = Number((q as any).setupDiscountPct || 0);
  const net = q.monthlyFee * (1 - q.discountPct / 100);
  const onceList = q.implementationFee + q.migrationFee;
  const once = onceList * (1 - setupDisc / 100);
  const canSend = (ctx.can("quote.send") || ctx.can("pricing.approve")) && ["DRAFT", "APPROVED"].includes(q.status);
  return (<>
    <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3.5">
        <div className="flex h-14 w-28 shrink-0 items-center justify-center rounded-xl border border-ink-100 bg-white p-1.5 shadow-2xs">
          <img src="/manalix_logo.svg" alt="Manalix Technologies" className="h-full w-auto object-contain" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-ink-950 tracking-tight">{q.number}</h1>
            <Badge v={q.status} />
          </div>
          <p className="text-xs text-ink-600 mt-0.5">
            Commercial Proposal for <Link className="link font-semibold text-brand-700" href={`/leads/${q.institutionId}`}>{q.institution.legalName}</Link>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a href={`/api/quotes/${id}/pdf`} target="_blank" className="btn-primary flex items-center gap-1.5 shadow-2xs hover:shadow-md transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          <span>Download PDF Quotation</span>
        </a>
        {canSend && <ActionButton url={`/api/quotes/${id}/status`} body={{ action: "send" }} label="Mark sent" />}
        {q.status === "SENT" && <><ActionButton url={`/api/quotes/${id}/status`} body={{ action: "accept" }} label="Accepted" /><ActionButton url={`/api/quotes/${id}/status`} body={{ action: "reject" }} label="Rejected" /></>}
        {["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(q.status) && <ActionButton url={`/api/quotes/${id}/status`} body={{ action: "cancel" }} label="Cancel" confirm="Cancel this quote? The number stays in the register." />}
      </div>
    </div>
    {appr && <Card title="Pricing approval" className="mb-4"><div className="flex flex-wrap items-center gap-2 text-sm"><Badge v={appr.status} /><span>{appr.summary}</span>{appr.decisionNote && <span className="text-ink-500">— {appr.decisionNote}</span>}{appr.status === "PENDING" && ctx.can("pricing.approve") && <Link href="/approvals" className="link">Decide →</Link>}</div></Card>}
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Lines" className="lg:col-span-2">
        {q.lines.map((l) => <div key={l.key} className="flex justify-between border-b border-ink-100 py-1 text-sm"><span>{l.name}{l.kind === "ONE_TIME" ? " (one-time)" : " / month"}</span><span className="tabular-nums">{inr(l.amount)}</span></div>)}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact k="Monthly Net SaaS" v={`${inr(net)}${q.discountPct > 0 ? ` (${q.discountPct}% off)` : ""}`} />
          <Fact k="One-Time Setup & Migration" v={`${inr(once)}${setupDisc > 0 ? ` (${setupDisc}% off)` : ""}`} />
          <Fact k="Annual Value (ARR)" v={inr(net * 12)} />
          <Fact k={`GST ${q.gstRate}%`} v="Extra" />
        </div>
        {q.scope && <p className="mt-3 text-sm"><b>Scope:</b> {q.scope}</p>}
        <p className="mt-3 whitespace-pre-wrap text-xs text-ink-700">{q.terms}</p>
      </Card>
      <Card title="Details"><dl className="space-y-2"><Fact k="Model" v={q.model} /><Fact k="Members / branches" v={`${q.members.toLocaleString("en-IN")} / ${q.branches}`} /><Fact k="Valid until" v={dt(q.validUntil)} />
        <Fact k="Prepared by" v={q.createdBy.name} /><Fact k="Payment terms" v="100% Upfront (One-time Full Payment)" /></dl></Card>
      <Card title="Bank Remittance Details (NEFT / RTGS / IMPS)" className="lg:col-span-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <Fact k="Beneficiary Name" v="SAIKHLEARN & SCHOLAR NEXUS PRIVATE LIMITED" />
          <Fact k="Bank Name" v="RBL Bank Limited" />
          <Fact k="Account Number" v="409002566529" />
          <Fact k="Account Type" v="Current Account" />
          <Fact k="IFSC Code" v="RATN0000157" />
          <Fact k="Branch" v="Pune Camp Branch, Moledina Road, Camp, Pune - 411001" />
        </div>
      </Card>
    </div>
  </>);
}
