import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { instScope } from "@/lib/access";
import { dt } from "@/lib/format";
import { Badge, Card, Fact, PageHeader } from "@/components/ui";
import { JsonForm } from "@/components/client/JsonForm";
import { Disclosure } from "@/components/client/Disclosure";
import { competitorFields } from "@/lib/competitorFields";
export const dynamic = "force-dynamic";
export default async function Competitor({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage("competitor.view"); const { id } = await params;
  const c = await db.query.competitors.findFirst({ where: eq(t.competitors.id, id), with: { sources: true } }); if (!c) notFound();
  const insts = await db.select({ id: t.institutions.id, name: t.institutions.legalName, vc: t.institutions.vendorClass }).from(t.institutions)
    .where(and(instScope(ctx), sql`lower(${t.institutions.cbsVendor}) = lower(${c.name})`)).limit(100);
  const edit = ctx.can("competitor.edit") && !ctx.grant;
  return (<>
    <PageHeader title={c.name} sub={<span className="flex gap-2">{c.product}<Badge v={c.verification} /></span>} />
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2"><dl className="grid gap-4 sm:grid-cols-2">{competitorFields.filter((f) => !["name", "verification"].includes(f.name)).map((f) => <Fact key={f.name} k={f.label} v={(c as any)[f.name]} href={f.name === "website"} />)}</dl>
        {edit && <Disclosure label="Edit"><JsonForm action={`/api/competitors/${id}`} method="PATCH" fields={competitorFields} initial={c} /></Disclosure>}</Card>
      <div className="space-y-4">
        <Card title="Evidence">{c.sources.map((s) => <div key={s.id} className="mb-2 text-sm"><b>{s.name}</b> <Badge v={s.classification} />{s.url && <a className="link block break-all text-xs" href={s.url} target="_blank" rel="noreferrer">{s.url}</a>}<div className="text-xs text-ink-500">{dt(s.accessedAt)}{s.evidence ? ` — ${s.evidence}` : ""}</div></div>)}
          {edit && <Disclosure label="Add source"><JsonForm action={`/api/competitors/${id}/sources`} cols={1} fields={[{ name: "name", label: "Source", required: true }, { name: "url", label: "URL" }, { name: "accessedAt", label: "Accessed", type: "date" },
            { name: "classification", label: "Classification", type: "select", options: ["VERIFIED_FACT", "PUBLICLY_REPORTED", "ESTIMATE"].map((v) => ({ value: v, label: v })) }, { name: "evidence", label: "What it shows", type: "textarea" }]} initial={{ classification: "PUBLICLY_REPORTED" }} /></Disclosure>}</Card>
        <Card title={`Incumbent at (${insts.length})`}>{insts.map((i) => <Link key={i.id} href={`/leads/${i.id}`} className="block text-sm hover:text-brand-600">{i.name} <span className="text-xs text-ink-500">{i.vc ? i.vc.replace(/_/g, " ").toLowerCase() : "unknown"}</span></Link>)}</Card>
      </div>
    </div>
  </>);
}
