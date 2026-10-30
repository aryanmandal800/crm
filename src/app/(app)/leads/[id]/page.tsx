import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { dealScope, getInstitutionOr404 } from "@/lib/access";
import { enumOpt, opt, options } from "@/lib/options";
import { priceFor } from "@/lib/pricing";
import { OPPORTUNITY_CATEGORIES } from "@/lib/scoring";
import { SIGNAL_LABELS } from "@/lib/schemas";
import { dt, dtt, inr, label, num } from "@/lib/format";
import { AiBox, Badge, BandBadge, Card, Empty, Fact, PageHeader } from "@/components/ui";
import { JsonForm } from "@/components/client/JsonForm";
import { ActionButton } from "@/components/client/ActionButton";
import { Disclosure } from "@/components/client/Disclosure";

export const dynamic = "force-dynamic";

const FIELD_KEYS = ["legalName", "regNumber", "regDate", "address", "taluka", "branchCount", "website", "landline", "mobile", "email", "totalMembers", "activeMembers",
  "totalDeposits", "loanBook", "totalAssets", "annualProfit", "netWorth", "employeeCount", "cbsVendor", "cbsProduct", "hosting", "mobileApp", "ekyc", "upiIntegration", "centralisedCbs"];

export default async function LeadProfile({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage("lead.view.all", "lead.view.team", "lead.view.own");
  const { id } = await params;
  const base = await getInstitutionOr404(ctx, id).catch(() => null); if (!base) notFound();
  const i = (await db.query.institutions.findFirst({ where: eq(t.institutions.id, id), with: { type: true, taluka: true, district: true, owner: true, contacts: true, signals: true, sources: true } }))!;
  const o = await options();
  const [acts, deals, quotes] = await Promise.all([
    db.query.activities.findMany({ where: eq(t.activities.institutionId, id), with: { user: true, contact: true }, orderBy: desc(t.activities.occurredAt), limit: 100 }),
    ctx.can("deal.view") ? db.query.deals.findMany({ where: and(eq(t.deals.institutionId, id), dealScope(ctx)), with: { stage: true, owner: true } }) : Promise.resolve([]),
    ctx.can("pricing.view") ? db.select().from(t.quotes).where(eq(t.quotes.institutionId, id)).orderBy(desc(t.quotes.createdAt)) : Promise.resolve([]),
  ]);
  const fs = (i.factStatus ?? {}) as Record<string, string>;
  const members = i.activeMembers ?? i.totalMembers;
  const insightModules = (i.insights?.modules ?? []).filter((k) => o.modules.some((m) => m.key === k));
  const price = ctx.can("pricing.view") ? await priceFor({ members: members ?? null, branches: i.branchCount, modules: insightModules }) : null;
  const manualParams = o.params.filter((p) => p.kind === "MANUAL");
  const ro = !!ctx.grant;
  const canResearch = ctx.can("research.edit") && !ro;

  return (<>
    <PageHeader title={i.legalName} sub={<span className="flex flex-wrap items-center gap-2">
      <span>{i.leadCode}</span><BandBadge band={i.scoreBand} score={i.score} /><Badge v={i.verification} />
      <span className="text-xs">{OPPORTUNITY_CATEGORIES[i.opportunityCategory]}</span>
      <span className="text-xs">· {i.type.name}{i.type.isPrimary ? "" : " (expansion category)"}</span>
      <span className="text-xs">· Owner: {i.owner?.name ?? "Unassigned"}</span>
      {i.tags.map((tg) => <Badge key={tg} v="TAG">#{tg}</Badge>)}
    </span>} actions={!ro && <>
      {ctx.can("lead.edit") && <Link href={`/leads/${id}/edit`} className="btn-ghost">Edit</Link>}
      {(ctx.can("research.edit") || ctx.can("pricing.view")) && <ActionButton url={`/api/leads/${id}/insights`} label="Generate AI insights" />}
      {ctx.can("quote.create") && <Link href={`/quotes/new?institution=${id}`} className="btn-ghost">New quote</Link>}
      {ctx.can("lead.delete") && <ActionButton url={`/api/leads/${id}`} method="DELETE" label="Archive" confirm="Archive this institution? It will be hidden from lists (audit trail kept)." redirectTo="/leads" className="btn-ghost text-red-600" />}
    </>} />

    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {/* ── Intelligence ── */}
        <Card title={`Lead score ${i.score}/100`} actions={<span className="text-xs text-ink-500">Scored {dtt(i.scoredAt)}</span>}>
          <div className="space-y-2">
            {i.scoreBreakdown.map((l) => (
              <div key={l.key} className="grid grid-cols-[1fr_auto] gap-x-3 text-sm">
                <div><span className="font-medium">{l.name}</span><div className="text-xs text-ink-500">{l.reason}</div></div>
                <div className="text-right font-semibold tabular-nums">{l.points}<span className="text-ink-500">/{l.max}</span></div>
                <div className="col-span-2 h-1.5 overflow-hidden rounded bg-ink-100"><div className="h-full bg-brand-500" style={{ width: `${(l.points / l.max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          {i.missingInfo.length > 0 && <div className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900"><b>Missing information:</b> {i.missingInfo.join(" · ")}</div>}
          {manualParams.length > 0 && canResearch && (
            <Disclosure label="Analyst scoring inputs">
              <JsonForm action={`/api/leads/${id}/manual-scores`} cols={3} fields={manualParams.map((p) => ({ name: p.key, label: `${p.name} (0–${p.maxScore})`, type: "number", help: p.guidance ?? undefined }))}
                initial={i.manualScores} extra={{}} submitLabel="Save scores" />
            </Disclosure>
          )}
        </Card>

        <Card title="Opportunity insights">
          {i.insights ? (
            <AiBox source={`${i.insightsSource ?? ""} · ${dtt(i.insightsAt)}`}>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {([["Why approach", i.insights.whyApproach], ["Why now", i.insights.whyNow], ["Likely pain point", i.insights.painPoint], ["Who may influence", i.insights.influencers],
                  ["Price to offer", ctx.can("pricing.view") ? i.insights.price : "Restricted"], ["What could prevent closure", i.insights.blockers]] as [string, string][]).map(([k, v]) => <div key={k}><dt className="text-xs font-semibold text-violet-800">{k}</dt><dd>{v}</dd></div>)}
                <div><dt className="text-xs font-semibold text-violet-800">Modules to pitch</dt><dd>{i.insights.modules.map((m) => o.modules.find((x) => x.key === m)?.name ?? m).join(", ") || "—"}</dd></div>
                <div><dt className="text-xs font-semibold text-violet-800">Missing information</dt><dd>{i.insights.missing.join(", ") || "—"}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs font-semibold text-violet-800">Evidence on file</dt><dd><ul className="list-disc pl-5">{i.insights.evidence.map((e, k) => <li key={k}>{e}</li>)}</ul></dd></div>
                <div className="sm:col-span-2 rounded bg-white p-2"><dt className="text-xs font-semibold text-violet-800">Next best action</dt><dd className="font-medium">{i.insights.nextAction}</dd></div>
              </dl>
              <p className="mt-2 text-[11px] text-violet-700">{i.insights.disclaimer}</p>
            </AiBox>
          ) : <Empty>No insights yet. Use “Generate AI insights” — it uses only the evidence recorded here.</Empty>}
        </Card>

        {price && (
          <Card title="Pricing recommendation" actions={<Link href={`/catalogue?members=${members ?? ""}&branches=${i.branchCount ?? ""}`} className="link text-xs">Open calculator</Link>}>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Fact k="Model" v={label(price.model)} /><Fact k="Monthly SaaS (list)" v={inr(price.monthly)} />
              <Fact k="Implementation + migration" v={inr(price.oneTime)} /><Fact k="Annual contract value" v={inr(price.arr)} />
              <Fact k="Negotiation range / month" v={`${inr(price.negotiation.minAcceptableMonthly)} – ${inr(price.negotiation.listMonthly)}`} />
              <Fact k="Minimum acceptable / month" v={inr(price.negotiation.minAcceptableMonthly)} /><Fact k="First-year value" v={inr(price.firstYearValue)} />
              <Fact k="Suggested paid pilot" v={`${inr(price.pilot.fee)} (${price.pilot.months} mo)`} />
            </div>
            <p className="mt-2 text-xs text-ink-500">{price.commercialModel} {price.rationale.join(". ")}.</p>
            <p className="mt-1 text-[11px] italic text-ink-500">{price.assumptionNote}</p>
          </Card>
        )}

        {/* ── Activities ── */}
        <Card title="Activity history" actions={ctx.can("activity.create") && !ro ? <span className="text-xs text-ink-500">{acts.length} logged</span> : null}>
          {ctx.can("activity.create") && !ro && (
            <Disclosure label="Log activity / schedule follow-up" open={acts.length === 0}>
              <JsonForm action="/api/activities" extra={{ institutionId: id }} cols={3} fields={[
                { name: "typeKey", label: "Type", type: "select", required: true, options: o.activityTypes.map((a) => ({ value: a.key, label: a.name })) },
                { name: "status", label: "Status", type: "select", required: true, options: [{ value: "DONE", label: "Done" }, { value: "PLANNED", label: "Planned / scheduled" }] },
                { name: "occurredAt", label: "When", type: "datetime" },
                { name: "contactId", label: "With", type: "select", options: i.contacts.map((c) => ({ value: c.id, label: `${c.name} (${label(c.role)})` })) },
                { name: "dealId", label: "Deal", type: "select", options: deals.map((d) => ({ value: d.id, label: d.title })) },
                { name: "outcome", label: "Outcome", type: "select", options: enumOpt(["CONNECTED", "NO_ANSWER", "WRONG_NUMBER", "CALLBACK_REQUESTED", "INTERESTED", "NOT_INTERESTED", "MEETING_BOOKED", "DEMO_BOOKED"]) },
                { name: "decisionMakerReached", label: "Decision-maker reached", type: "checkbox" }, { name: "meaningful", label: "Meaningful conversation", type: "checkbox" },
                { name: "notes", label: "Notes", type: "textarea" }, { name: "objection", label: "Objection raised" }, { name: "feedback", label: "Feedback" },
                { name: "nextAction", label: "Next action" }, { name: "followUpDate", label: "Follow-up date", type: "datetime" },
              ]} initial={{ status: "DONE", typeKey: "CALL" }} submitLabel="Log" />
            </Disclosure>
          )}
          <ol className="mt-3 space-y-3">
            {acts.map((a) => (
              <li key={a.id} className="border-l-2 border-brand-200 pl-3 text-sm">
                <div className="flex flex-wrap items-center gap-2"><b>{o.activityTypes.find((x) => x.key === a.typeKey)?.name ?? a.typeKey}</b>
                  {a.status !== "DONE" && <Badge v={a.status} />}{a.outcome && <Badge v={a.outcome} />}{a.decisionMakerReached && <Badge v="VERIFIED">DM reached</Badge>}
                  <span className="text-xs text-ink-500">{dtt(a.occurredAt)} · {a.user.name}{a.contact ? ` · with ${a.contact.name}` : ""}</span></div>
                {a.notes && <p className="mt-0.5 whitespace-pre-wrap">{a.notes}</p>}
                {a.objection && <p className="text-xs text-red-700">Objection: {a.objection}</p>}
                {a.feedback && <p className="text-xs text-ink-700">Feedback: {a.feedback}</p>}
                {a.nextAction && <p className="text-xs text-brand-700">Next: {a.nextAction}{a.followUpDate ? ` — ${dtt(a.followUpDate)}` : ""}</p>}
              </li>
            ))}
            {!acts.length && <li className="text-sm text-ink-500">No activity yet.</li>}
          </ol>
        </Card>

        {/* ── Signals ── */}
        <Card title="Buying signals">
          {i.signals.length ? <ul className="space-y-2">{i.signals.map((s) => (
            <li key={s.id} className="rounded-lg border border-ink-100 p-2 text-sm">
              <div className="flex flex-wrap items-center gap-2"><b>{SIGNAL_LABELS[s.type] ?? s.type}</b><Badge v={s.strength}>strength {s.strength.toLowerCase()}</Badge><Badge v={s.confidence}>confidence {s.confidence.toLowerCase()}</Badge><span className="text-xs text-ink-500">{dt(s.signalDate)}</span>
                {canResearch && <span className="ml-auto"><ActionButton url={`/api/signals/${s.id}`} method="DELETE" label="Remove" confirm="Remove signal?" className="text-xs text-red-600" /></span>}</div>
              <p>{s.description}</p>
              {s.evidenceUrl && <a className="link break-all text-xs" href={s.evidenceUrl} target="_blank" rel="noreferrer">{s.evidenceUrl}</a>}
              {s.recommendedAction && <p className="text-xs text-brand-700">Action: {s.recommendedAction}</p>}
            </li>))}</ul> : <Empty>No buying signals recorded.</Empty>}
          {canResearch && <Disclosure label="Add signal"><JsonForm action={`/api/leads/${id}/signals`} cols={3} fields={[
            { name: "type", label: "Signal", type: "select", required: true, options: Object.entries(SIGNAL_LABELS).map(([value, l]) => ({ value, label: l })) },
            { name: "signalDate", label: "Date", type: "date" }, { name: "evidenceUrl", label: "Evidence URL" },
            { name: "strength", label: "Strength", type: "select", options: enumOpt(["LOW", "MEDIUM", "HIGH"]) }, { name: "confidence", label: "Confidence", type: "select", options: enumOpt(["LOW", "MEDIUM", "HIGH"]) },
            { name: "recommendedAction", label: "Recommended sales action" }, { name: "description", label: "What happened (evidence)", type: "textarea", required: true },
          ]} initial={{ strength: "MEDIUM", confidence: "MEDIUM" }} submitLabel="Add signal" /></Disclosure>}
        </Card>

        {/* ── Sources ── */}
        <Card title="Research sources & evidence">
          {i.sources.length ? <ul className="space-y-2">{i.sources.map((s) => (
            <li key={s.id} className="rounded-lg border border-ink-100 p-2 text-sm">
              <div className="flex flex-wrap items-center gap-2"><b>{s.name}</b><Badge v={s.classification} /><Badge v={s.verification} /><Badge v={s.confidence}>confidence {s.confidence.toLowerCase()}</Badge>
                <span className="text-xs text-ink-500">accessed {dt(s.accessedAt)} · re-verify {dt(s.nextVerificationAt)}</span>
                {canResearch && <span className="ml-auto"><ActionButton url={`/api/sources/${s.id}`} method="DELETE" label="Remove" confirm="Remove source?" className="text-xs text-red-600" /></span>}</div>
              {s.url && <a className="link break-all text-xs" href={s.url} target="_blank" rel="noreferrer">{s.url}</a>}
              {s.evidence && <p className="mt-1 whitespace-pre-wrap text-xs text-ink-700">“{s.evidence}”</p>}
              {s.fieldKeys.length > 0 && <p className="text-[11px] text-ink-500">Supports: {s.fieldKeys.join(", ")}</p>}
            </li>))}</ul> : <Empty>No sources recorded — every fact should have one.</Empty>}
          {canResearch && <Disclosure label="Add source"><JsonForm action={`/api/leads/${id}/sources`} cols={3} fields={[
            { name: "name", label: "Source name", required: true, placeholder: "e.g. Society annual report 2024-25" }, { name: "url", label: "URL" }, { name: "accessedAt", label: "Date accessed", type: "date" },
            { name: "classification", label: "Classification", type: "select", options: enumOpt(["VERIFIED_FACT", "PUBLICLY_REPORTED", "ESTIMATE"]) },
            { name: "verification", label: "Verification", type: "select", options: enumOpt(["UNVERIFIED", "PARTIAL", "VERIFIED", "DISPUTED"]) },
            { name: "confidence", label: "Confidence", type: "select", options: enumOpt(["LOW", "MEDIUM", "HIGH"]) },
            { name: "fieldKeys", label: "Fields this source supports", type: "multiselect", options: FIELD_KEYS.map((k) => ({ value: k, label: k })) },
            { name: "evidence", label: "Evidence extracted (short excerpt / note)", type: "textarea" },
          ]} initial={{ classification: "PUBLICLY_REPORTED", verification: "UNVERIFIED", confidence: "MEDIUM", fieldKeys: [] }} submitLabel="Add source" /></Disclosure>}
        </Card>
      </div>

      <div className="space-y-4">
        {/* ── Deals ── */}
        {ctx.can("deal.view") && <Card title="Deals">
          {deals.map((d) => (
            <Link key={d.id} href={`/deals/${d.id}`} className="mb-2 block rounded-lg border border-ink-100 p-2 text-sm hover:border-brand-400">
              <div className="font-medium">{d.title}</div><div className="text-xs text-ink-500">{d.stage.name} · {d.owner.name} · MRR {inr(d.mrr)}</div>
              {d.followUpDate && <div className="text-xs text-brand-700">Follow up {dt(d.followUpDate)}</div>}
            </Link>))}
          {!deals.length && <p className="muted">No deal yet.</p>}
          {ctx.can("deal.create") && !ro && <Disclosure label="Create deal" open={!deals.length}>
            <JsonForm action="/api/deals" extra={{ institutionId: id }} cols={1} redirectTo="/deals/{id}" fields={[
              { name: "title", label: "Deal title", required: true },
              { name: "stageId", label: "Stage", type: "select", required: true, options: o.stages.filter((s) => s.isOpen).map((s) => ({ value: s.id, label: s.name })) },
              { name: "opportunityCategory", label: "Opportunity", type: "select", required: true, options: Object.entries(OPPORTUNITY_CATEGORIES).map(([value, l]) => ({ value, label: l })) },
              { name: "nextAction", label: "Next action", required: true }, { name: "followUpDate", label: "Follow-up date", type: "date", required: true },
              { name: "mrr", label: "Expected MRR (₹)", type: "number" },
            ]} initial={{ title: `${i.shortName ?? i.legalName} — Fivopay`, stageId: o.stages.find((s) => s.key === "NEW")?.id, opportunityCategory: i.opportunityCategory === "NOT_QUALIFIED" ? "GREENFIELD_CBS" : i.opportunityCategory, mrr: price?.monthly }} submitLabel="Create deal" />
          </Disclosure>}
        </Card>}

        {/* ── Decision makers ── */}
        <Card title="Decision makers">
          {i.contacts.map((c) => (
            <div key={c.id} className="mb-2 rounded-lg border border-ink-100 p-2 text-sm">
              <div className="flex flex-wrap items-center gap-1.5"><b>{c.name}</b><Badge v={c.verification} />
                {c.isFinalApprover && <Badge v="APPROVED">Final approver</Badge>}{c.isDecisionMaker && <Badge v="HIGH">Decision maker</Badge>}{c.isChampion && <Badge v="SUCCESS">Champion</Badge>}{c.isInfluencer && <Badge v="MEDIUM">Influencer</Badge>}</div>
              <div className="text-xs text-ink-500">{c.designation ?? label(c.role)} · relationship {c.relationshipStrength}/5{c.lastMetAt ? ` · met ${dt(c.lastMetAt)}` : ""}</div>
              <div className="text-xs">{c.businessPhone ?? ""} {c.businessEmail ?? ""}</div>
              {c.sourceUrl && <a className="link text-[11px]" href={c.sourceUrl} target="_blank" rel="noreferrer">source</a>}
              {ctx.can("contact.edit") && !ro && <Disclosure label="Edit"><JsonForm action={`/api/contacts/${c.id}`} method="PATCH" cols={1} fields={contactFields} initial={c} /></Disclosure>}
            </div>))}
          {!i.contacts.length && <p className="muted">No decision makers identified.</p>}
          {ctx.can("contact.edit") && !ro && <Disclosure label="Add decision maker"><JsonForm action={`/api/leads/${id}/contacts`} cols={1} fields={contactFields} initial={{ role: "CEO_MD", verification: "UNVERIFIED", relationshipStrength: 0 }} submitLabel="Add" /></Disclosure>}
        </Card>

        {/* ── Facts ── */}
        <Card title="Institution profile">
          <dl className="grid grid-cols-2 gap-3">
            <Fact k="Registration no." v={i.regNumber} status={fs.regNumber} /><Fact k="Registered" v={i.regDate ? dt(i.regDate) : null} status={fs.regDate} />
            <Fact k="Authority" v={i.regAuthority} /><Fact k="Status" v={i.status === "UNKNOWN" ? null : label(i.status)} />
            <Fact k="Taluka" v={i.taluka?.name} status={fs.taluka} /><Fact k="City / PIN" v={[i.city, i.pinCode].filter(Boolean).join(" ") || null} />
            <div className="col-span-2"><Fact k="Head office" v={i.address} status={fs.address} /></div>
            <Fact k="Branches" v={num(i.branchCount) === "—" ? null : num(i.branchCount)} status={fs.branchCount} /><Fact k="Multi-state" v={i.multiState == null ? null : i.multiState ? "Yes" : "No"} />
            <Fact k="Website" v={i.website} status={fs.website} href /><Fact k="Maps / listing" v={i.mapsUrl} href />
            <Fact k="Landline" v={i.landline} status={fs.landline} /><Fact k="Mobile" v={i.mobile} status={fs.mobile} />
            <Fact k="Email" v={i.email} status={fs.email} /><Fact k="Contact verification" v={label(i.contactVerification)} />
          </dl>
        </Card>
        <Card title="Size & financials">
          <dl className="grid grid-cols-2 gap-3">
            <Fact k="Total members" v={i.totalMembers != null ? num(i.totalMembers) : null} status={fs.totalMembers} /><Fact k="Active members" v={i.activeMembers != null ? num(i.activeMembers) : null} status={fs.activeMembers} />
            <Fact k="Deposits" v={i.totalDeposits != null ? inr(i.totalDeposits, { compact: true }) : null} status={fs.totalDeposits} /><Fact k="Loan book" v={i.loanBook != null ? inr(i.loanBook, { compact: true }) : null} status={fs.loanBook} />
            <Fact k="Total assets" v={i.totalAssets != null ? inr(i.totalAssets, { compact: true }) : null} status={fs.totalAssets} /><Fact k="Profit / loss" v={i.annualProfit != null ? inr(i.annualProfit, { compact: true }) : null} status={fs.annualProfit} />
            <Fact k="Net worth" v={i.netWorth != null ? inr(i.netWorth, { compact: true }) : null} status={fs.netWorth} /><Fact k="Employees" v={i.employeeCount != null ? num(i.employeeCount) : null} status={fs.employeeCount} />
            <Fact k="Financial year" v={i.financialYear} /><Fact k="Confidence" v={i.financialConfidence ? label(i.financialConfidence) : null} />
          </dl>
        </Card>
        <Card title="Technology">
          <dl className="grid grid-cols-2 gap-3">
            <Fact k="CBS vendor" v={i.cbsVendor} status={fs.cbsVendor} /><Fact k="Product" v={i.cbsProduct} status={fs.cbsProduct} />
            <Fact k="Vendor status" v={label(i.vendorClass)} /><Fact k="Hosting" v={i.hosting === "UNKNOWN" ? null : label(i.hosting)} status={fs.hosting} />
            {(["centralisedCbs", "mobileApp", "internetBanking", "upiIntegration", "digitalLoans", "ekyc"] as const).map((k) => <Fact key={k} k={label(k.replace(/([A-Z])/g, "_$1"))} v={i[k] === "UNKNOWN" ? null : <Badge v={i[k]} />} status={fs[k]} />)}
            <div className="col-span-2"><Fact k="Legacy evidence" v={i.legacyEvidence} /></div>
            <div className="col-span-2"><Fact k="Contract renewal" v={i.contractRenewal} /></div>
            <div className="col-span-2"><Fact k="Complaints (evidenced)" v={i.techComplaints} /></div>
          </dl>
          <p className="mt-2 text-[11px] text-ink-500">A missing website or app does not prove an institution lacks CBS software.</p>
        </Card>

        <Card title="Qualification">
          {ctx.can("lead.edit") && !ro ? (
            <QualificationForm id={id} questions={o.questions} answers={i.qualification} />
          ) : <dl className="space-y-2 text-sm">{o.questions.map((q) => <div key={q.id}><dt className="text-xs text-ink-500">{q.text}</dt><dd>{i.qualification?.[q.id] ?? "—"}</dd></div>)}</dl>}
        </Card>

        {quotes.length > 0 && <Card title="Quotations">{quotes.map((q) => <Link key={q.id} href={`/quotes/${q.id}`} className="mb-1 flex justify-between text-sm hover:text-brand-600"><span>{q.number}</span><Badge v={q.status} /></Link>)}</Card>}
      </div>
    </div>
  </>);
}

const contactFields = [
  { name: "name", label: "Name", required: true },
  { name: "role", label: "Role", type: "select" as const, required: true, options: enumOpt(["CHAIRMAN", "VICE_CHAIRMAN", "SECRETARY", "CEO_MD", "GENERAL_MANAGER", "IT_MANAGER", "FINANCE_HEAD", "DIRECTOR", "BRANCH_MANAGER", "INFLUENCER", "OTHER"]) },
  { name: "designation", label: "Designation (as published)" },
  { name: "businessPhone", label: "Business phone (public only)" }, { name: "businessEmail", label: "Business email (public only)", type: "email" as const },
  { name: "linkedinUrl", label: "LinkedIn" }, { name: "sourceUrl", label: "Source URL" },
  { name: "verification", label: "Verification", type: "select" as const, options: enumOpt(["UNVERIFIED", "PARTIAL", "VERIFIED", "DISPUTED"]) },
  { name: "relationshipStrength", label: "Relationship (0–5)", type: "number" as const },
  { name: "isDecisionMaker", label: "Decision maker", type: "checkbox" as const }, { name: "isFinalApprover", label: "Final approving authority", type: "checkbox" as const },
  { name: "isChampion", label: "Internal champion", type: "checkbox" as const }, { name: "isInfluencer", label: "Influencer", type: "checkbox" as const },
  { name: "lastMetAt", label: "Last met", type: "date" as const }, { name: "notes", label: "Notes", type: "textarea" as const },
];

function QualificationForm({ id, questions, answers }: { id: string; questions: { id: string; text: string }[]; answers: Record<string, string> }) {
  return <JsonForm action={`/api/leads/${id}/qualification`} cols={1} fields={questions.map((q) => ({ name: q.id, label: q.text, type: "textarea" }))} initial={answers} submitLabel="Save answers" />;
}
