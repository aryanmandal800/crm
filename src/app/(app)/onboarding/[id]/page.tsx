import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { getInstitutionOr404 } from "@/lib/access";
import { options } from "@/lib/options";
import { dt, inr } from "@/lib/format";
import { Badge, Card, Fact, PageHeader } from "@/components/ui";
import { JsonForm } from "@/components/client/JsonForm";
import { ActionButton } from "@/components/client/ActionButton";
export const dynamic = "force-dynamic";
export default async function OnboardingDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage("onboarding.view"); const { id } = await params;
  const o = await db.query.onboardings.findFirst({ where: eq(t.onboardings.id, id), with: { institution: true, deal: true, owner: true } }); if (!o) notFound();
  if (!(await getInstitutionOr404(ctx, o.institutionId).catch(() => null))) notFound();
  const opts = await options(); const edit = ctx.can("onboarding.edit") && !ctx.grant;
  return (<>
    <PageHeader title={`Onboarding — ${o.institution.legalName}`} sub={<span className="flex gap-2"><Badge v={o.status === "LIVE" ? "SUCCESS" : o.status}>{o.status}</Badge><Link className="link" href={`/deals/${o.dealId}`}>Deal</Link></span>} />
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Implementation checklist" className="lg:col-span-2">
        {o.steps.map((s) => (
          <div key={s.key} className="flex flex-wrap items-center gap-2 border-b border-ink-100 py-2 text-sm">
            <Badge v={s.status} /><span className="flex-1 font-medium">{s.name}</span>{s.completedAt && <span className="text-xs text-ink-500">{dt(s.completedAt)}</span>}
            {edit && s.status !== "DONE" && <><ActionButton url={`/api/onboarding/${id}`} method="PATCH" body={{ step: { key: s.key, status: "IN_PROGRESS" } }} label="Start" className="btn-ghost px-2 py-1 text-xs" />
              <ActionButton url={`/api/onboarding/${id}`} method="PATCH" body={{ step: { key: s.key, status: "DONE" } }} label="Done" className="btn-primary px-2 py-1 text-xs" />
              <ActionButton url={`/api/onboarding/${id}`} method="PATCH" body={{ step: { key: s.key, status: "BLOCKED" } }} label="Blocked" className="btn-ghost px-2 py-1 text-xs" /></>}
            {s.notes && <p className="w-full text-xs text-ink-500">{s.notes}</p>}
          </div>))}
      </Card>
      <Card title="Commercials & ownership">
        <dl className="mb-3 grid grid-cols-2 gap-3"><Fact k="Contract value (yr 1)" v={inr(o.contractValue)} /><Fact k="Advance received" v={inr(o.advanceReceived)} /><Fact k="Outstanding" v={inr(o.outstandingAmount)} /><Fact k="Go-live" v={o.goLiveDate ? dt(o.goLiveDate) : null} /></dl>
        {edit && <JsonForm action={`/api/onboarding/${id}`} method="PATCH" cols={1} fields={[
          { name: "ownerId", label: "Implementation owner", type: "select", options: opts.users.map((u) => ({ value: u.id, label: u.name })) },
          { name: "advanceReceived", label: "Advance received (₹)", type: "number" }, { name: "outstandingAmount", label: "Outstanding (₹)", type: "number" },
          { name: "goLiveDate", label: "Go-live date", type: "date" }, { name: "status", label: "Status", type: "select", options: ["IN_PROGRESS", "LIVE", "ON_HOLD"].map((v) => ({ value: v, label: v })) },
          { name: "notes", label: "Notes", type: "textarea" }]} initial={o} />}
      </Card>
    </div>
  </>);
}
