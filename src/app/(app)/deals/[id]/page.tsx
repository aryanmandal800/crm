import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { getDealOr404 } from "@/lib/access";
import { assignable, opt, options } from "@/lib/options";
import { OPPORTUNITY_CATEGORIES } from "@/lib/scoring";
import { dt, dtt, inr } from "@/lib/format";
import { Badge, BandBadge, Card, Fact, PageHeader } from "@/components/ui";
import { JsonForm } from "@/components/client/JsonForm";

export const dynamic = "force-dynamic";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage("deal.view");
  const { id } = await params;
  const base = await getDealOr404(ctx, id).catch(() => null); if (!base) notFound();
  const d = (await db.query.deals.findFirst({ where: eq(t.deals.id, id), with: { institution: true, stage: true, owner: true, lostReason: true, competitor: true, history: true } }))!;
  const o = await options();
  const [acts, quotes, [onb]] = await Promise.all([
    db.query.activities.findMany({ where: eq(t.activities.dealId, id), with: { user: true }, orderBy: desc(t.activities.occurredAt) }),
    db.select().from(t.quotes).where(eq(t.quotes.dealId, id)).orderBy(desc(t.quotes.createdAt)),
    db.select({ id: t.onboardings.id, status: t.onboardings.status }).from(t.onboardings).where(eq(t.onboardings.dealId, id)),
  ]);
  const prob = d.probabilityOverride ?? d.stage.probability;
  const locked = d.financialsLocked && !ctx.can("deal.edit_locked");
  const editable = ctx.can("deal.edit") && !ctx.grant;

  return (<>
    <PageHeader title={d.title} sub={<span className="flex flex-wrap items-center gap-2"><Link className="link" href={`/leads/${d.institutionId}`}>{d.institution.legalName}</Link>
      <BandBadge band={d.institution.scoreBand} score={d.institution.score} /><Badge v={d.stage.isWon ? "SUCCESS" : d.stage.isLost ? "FAILED" : "IN_PROGRESS"}>{d.stage.name}</Badge>
      {d.financialsLocked && <Badge v="VERIFIED">Financials locked</Badge>}{d.founderFlag && <Badge v="AI">Founder intervention</Badge>}</span>}
      actions={<>{ctx.can("quote.create") && !ctx.grant && <Link href={`/quotes/new?institution=${d.institutionId}&deal=${id}`} className="btn-ghost">New quote</Link>}
        {onb && <Link href={`/onboarding/${onb.id}`} className="btn-ghost">Onboarding</Link>}</>} />

    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card title="Commercials">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact k="MRR" v={inr(d.mrr)} /><Fact k="Implementation" v={inr(d.implementationFee)} /><Fact k="ACV (12× MRR)" v={inr(d.mrr * 12)} />
            <Fact k="Weighted MRR" v={inr((d.mrr * prob) / 100)} /><Fact k="Probability" v={`${prob}%`} /><Fact k="Owner" v={d.owner.name} />
            <Fact k="Opportunity" v={OPPORTUNITY_CATEGORIES[d.opportunityCategory]} /><Fact k="Expected close" v={d.expectedCloseDate ? dt(d.expectedCloseDate) : null} />
            <Fact k="Next action" v={d.nextAction} /><Fact k="Follow-up" v={d.followUpDate ? dt(d.followUpDate) : null} />
            {d.lostReason && <Fact k="Lost reason" v={d.lostReason.name} />}{d.competitor && <Fact k="Competitor" v={d.competitor.name} />}
          </dl>
          {d.lostNotes && <p className="mt-2 text-sm text-ink-700">{d.lostNotes}</p>}
          {d.founderFlagReason && <p className="mt-2 text-sm text-violet-700">Founder help: {d.founderFlagReason}</p>}
        </Card>

        {editable && (
          <Card title="Update deal">
            {locked && <p className="mb-3 rounded bg-amber-50 p-2 text-xs text-amber-900">This deal is closed. Stage and financial values are locked — only the Super Admin can change them.</p>}
            <JsonForm action={`/api/deals/${id}`} method="PATCH" cols={3} fields={[
              ...(locked ? [] : [
                { name: "stageId", label: "Stage", type: "select" as const, required: true, options: o.stages.map((s) => ({ value: s.id, label: s.name })) },
                { name: "mrr", label: "MRR (₹)", type: "number" as const }, { name: "implementationFee", label: "Implementation fee (₹)", type: "number" as const },
              ]),
              { name: "nextAction", label: "Next action" }, { name: "followUpDate", label: "Follow-up", type: "date" },
              { name: "expectedCloseDate", label: "Expected close", type: "date" },
              { name: "probabilityOverride", label: "Probability override (%)", type: "number", help: "Leave blank to use stage default" },
              { name: "opportunityCategory", label: "Opportunity", type: "select", required: true, options: Object.entries(OPPORTUNITY_CATEGORIES).map(([value, label]) => ({ value, label })) },
              ...(ctx.can("lead.assign") ? [{ name: "ownerId", label: "Owner", type: "select" as const, required: true, options: opt(assignable(ctx, o.users)) }] : []),
              { name: "members", label: "Members (for pricing)", type: "number" }, { name: "branches", label: "Branches", type: "number" },
              { name: "lostReasonId", label: "Lost reason (if lost)", type: "select", options: opt(o.lostReasons) },
              { name: "competitorId", label: "Competitor involved", type: "select", options: opt(o.competitors) },
              { name: "modules", label: "Modules in scope", type: "multiselect", options: o.modules.map((m) => ({ value: m.key, label: m.name })) },
              { name: "lostNotes", label: "Lost / objection notes", type: "textarea" },
              { name: "founderFlag", label: "Needs founder intervention", type: "checkbox" }, { name: "founderFlagReason", label: "Why founder help is needed" },
              { name: "note", label: "Stage-change note", type: "textarea" },
            ]} initial={d} submitLabel="Update deal" />
          </Card>
        )}

        <Card title="Activity on this deal">
          {acts.map((a) => <div key={a.id} className="border-l-2 border-brand-200 py-1 pl-3 text-sm"><b>{a.typeKey}</b> <span className="text-xs text-ink-500">{dtt(a.occurredAt)} · {a.user.name}</span>{a.notes && <p>{a.notes}</p>}</div>)}
          {!acts.length && <p className="muted">Log activities from the <Link className="link" href={`/leads/${d.institutionId}`}>institution profile</Link>.</p>}
        </Card>
      </div>
      <div className="space-y-4">
        <Card title="Stage history">
          <ol className="space-y-2 text-sm">{[...d.history].sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime()).map((h) => (
            <li key={h.id}><b>{o.stages.find((s) => s.key === h.toStage)?.name ?? h.toStage}</b>{h.fromStage && <span className="text-ink-500"> ← {o.stages.find((s) => s.key === h.fromStage)?.name}</span>}
              <div className="text-xs text-ink-500">{dtt(h.changedAt)}{h.note ? ` · ${h.note}` : ""}</div></li>))}</ol>
        </Card>
        <Card title="Quotations">{quotes.map((q) => <Link key={q.id} href={`/quotes/${q.id}`} className="mb-1 flex justify-between text-sm hover:text-brand-600"><span>{q.number}</span><Badge v={q.status} /></Link>)}{!quotes.length && <p className="muted">None yet.</p>}</Card>
      </div>
    </div>
  </>);
}
