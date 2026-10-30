import { asc } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { allSettings } from "@/lib/settings";
import { settingFields } from "@/lib/settingsForm";
import { Badge, Card, PageHeader } from "@/components/ui";
import { JsonForm, type FieldDef } from "@/components/client/JsonForm";
import { Disclosure } from "@/components/client/Disclosure";
export const dynamic = "force-dynamic";

function ListEditor({ entity, title, rows, fields, display, canEdit, initial }: { entity: string; title: string; rows: any[]; fields: FieldDef[]; display: (r: any) => React.ReactNode; canEdit: boolean; initial?: Record<string, any> }) {
  return (
    <Card title={title}>
      <div className="space-y-1">{rows.map((r) => (
        <div key={r.id} className="border-b border-ink-100 py-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">{display(r)}{r.active === false && <Badge v="LOW">inactive</Badge>}</div>
          {canEdit && <Disclosure label="Edit"><JsonForm action={`/api/taxonomy/${entity}/${r.id}`} method="PATCH" fields={fields.filter((f) => f.name !== "key")} initial={r} cols={2} /></Disclosure>}
        </div>))}</div>
      {canEdit && <Disclosure label="Add"><JsonForm action={`/api/taxonomy/${entity}`} fields={fields} initial={{ active: true, ...initial }} cols={2} /></Disclosure>}
    </Card>
  );
}

export default async function SettingsPage() {
  const ctx = await requirePage("settings.business", "settings.technical", "taxonomy.manage");
  const [s, districts, talukas, types, acts, lost, stages, params, questions] = await Promise.all([allSettings(),
    db.select().from(t.districts).orderBy(asc(t.districts.name)), db.select().from(t.talukas).orderBy(asc(t.talukas.name)), db.select().from(t.institutionTypes).orderBy(asc(t.institutionTypes.sortOrder)),
    db.select().from(t.activityTypes).orderBy(asc(t.activityTypes.sortOrder)), db.select().from(t.lostReasons), db.select().from(t.pipelineStages).orderBy(asc(t.pipelineStages.sortOrder)),
    db.select().from(t.scoringParameters).orderBy(asc(t.scoringParameters.sortOrder)), db.select().from(t.qualificationQuestions).orderBy(asc(t.qualificationQuestions.sortOrder))]);
  const biz = ctx.can("settings.business"), tech = ctx.can("settings.technical"), tax = ctx.can("taxonomy.manage") || biz, exp = ctx.can("expansion.manage");
  const section = (cat: string, title: string) => { const f = settingFields(cat, s); return <Card title={title}><JsonForm action="/api/settings" method="PATCH" fields={f.fields} initial={f.initial} /></Card>; };
  const totalMax = params.filter((p) => p.active).reduce((a, p) => a + p.maxScore, 0);
  return (<>
    <PageHeader title="Settings & business rules" sub="Everyday changes happen here directly. Every change is audit-logged." />
    <div className="space-y-4">
      {biz && <div className="grid gap-4 lg:grid-cols-2">{section("SCORING", "Lead scoring bands")}{section("SALES", "Sales rules & quote numbering")}{section("COMPANY", "Company details (used on quotations)")}</div>}
      {tech && <div className="grid gap-4 lg:grid-cols-2">{section("AI", "AI insights engine")}{section("NOTIFY", "Notifications")}{section("SYSTEM", "Backups")}</div>}

      {biz && <ListEditor entity="scoring" title={`Lead-scoring parameters (active max total ${totalMax}; scores are normalised to 100)`} rows={params} canEdit={biz}
        display={(r) => <><b>{r.name}</b><span className="text-xs text-ink-500">max {r.maxScore} · {r.kind.toLowerCase()}</span></>}
        fields={[{ name: "key", label: "Key", required: true }, { name: "name", label: "Name", required: true }, { name: "maxScore", label: "Max score", type: "number", required: true },
          { name: "kind", label: "Kind", type: "select", required: true, options: [{ value: "MANUAL", label: "Manual (analyst enters 0–max)" }, { value: "BUILTIN", label: "Built-in rule" }] },
          { name: "sortOrder", label: "Order", type: "number" }, { name: "active", label: "Active", type: "checkbox" }, { name: "guidance", label: "Guidance for analysts", type: "textarea" }]} initial={{ kind: "MANUAL", sortOrder: 99 }} />}

      {biz && <ListEditor entity="stages" title="Pipeline stages" rows={stages} canEdit={biz}
        display={(r) => <><b>{r.sortOrder}. {r.name}</b><span className="text-xs text-ink-500">{r.probability}% · stall after {r.stallDays}d{r.isWon ? " · won" : ""}{r.isLost ? " · lost" : ""}{!r.isOpen ? " · closed" : ""}{r.isQualified ? " · qualified" : ""}</span></>}
        fields={[{ name: "key", label: "Key", required: true }, { name: "name", label: "Name", required: true }, { name: "sortOrder", label: "Order", type: "number", required: true },
          { name: "probability", label: "Win probability %", type: "number", required: true }, { name: "stallDays", label: "Stalled after (days)", type: "number", required: true },
          { name: "isOpen", label: "Open stage", type: "checkbox" }, { name: "isQualified", label: "Counts as qualified", type: "checkbox" }, { name: "isWon", label: "Won", type: "checkbox" }, { name: "isLost", label: "Lost", type: "checkbox" }, { name: "active", label: "Active", type: "checkbox" }]}
        initial={{ isOpen: true, probability: 0, stallDays: 14, sortOrder: 99 }} />}

      <div className="grid gap-4 lg:grid-cols-2">
        {exp && <ListEditor entity="districts" title="Districts (expansion control)" rows={districts} canEdit={exp} display={(r) => <><b>{r.name}</b><span className="text-xs text-ink-500">{r.state} · {r.code}</span>{r.launched && <Badge v="SUCCESS">launched</Badge>}</>}
          fields={[{ name: "name", label: "District", required: true }, { name: "state", label: "State", required: true }, { name: "code", label: "Code (3 letters, used in lead IDs)", required: true }, { name: "launched", label: "Launched for sales", type: "checkbox" }, { name: "active", label: "Active", type: "checkbox" }]} initial={{ state: "Maharashtra" }} />}
        {tax && <ListEditor entity="talukas" title="Talukas" rows={talukas} canEdit={tax} display={(r) => <><b>{r.name}</b>{r.aliases.length > 0 && <span className="text-xs text-ink-500">aka {r.aliases.join(", ")}</span>}<span className="text-xs text-ink-500">{districts.find((d) => d.id === r.districtId)?.name}</span>{r.notes && <span className="w-full text-xs text-amber-700">{r.notes}</span>}</>}
          fields={[{ name: "name", label: "Taluka", required: true }, { name: "districtId", label: "District", type: "select", required: true, options: districts.map((d) => ({ value: d.id, label: d.name })) }, { name: "aliases", label: "Aliases (comma separated)", type: "tags" }, { name: "active", label: "Active", type: "checkbox" }, { name: "notes", label: "Notes", type: "textarea" }]} initial={{ districtId: districts[0]?.id }} />}
        {tax && <ListEditor entity="types" title="Institution categories" rows={types} canEdit={tax} display={(r) => <><b>{r.name}</b><span className="text-xs text-ink-500">{r.isPrimary ? "primary prospect" : "expansion category"}</span></>}
          fields={[{ name: "key", label: "Key", required: true }, { name: "name", label: "Name", required: true }, { name: "isPrimary", label: "Primary credit-society prospect", type: "checkbox" }, { name: "sortOrder", label: "Order", type: "number" }, { name: "active", label: "Active", type: "checkbox" }]} initial={{ isPrimary: true }} />}
        {tax && <ListEditor entity="activityTypes" title="Activity types" rows={acts} canEdit={tax} display={(r) => <><b>{r.name}</b>{r.countsAsCall && <span className="text-xs text-ink-500">counts as call</span>}</>}
          fields={[{ name: "key", label: "Key", required: true }, { name: "name", label: "Name", required: true }, { name: "countsAsCall", label: "Counts as a call", type: "checkbox" }, { name: "sortOrder", label: "Order", type: "number" }, { name: "active", label: "Active", type: "checkbox" }]} />}
        {tax && <ListEditor entity="lostReasons" title="Lost reasons" rows={lost} canEdit={tax} display={(r) => <b>{r.name}</b>}
          fields={[{ name: "key", label: "Key", required: true }, { name: "name", label: "Name", required: true }, { name: "active", label: "Active", type: "checkbox" }]} />}
        {biz && <ListEditor entity="questions" title="Customer qualification questions" rows={questions} canEdit={biz} display={(r) => <span>{r.text}</span>}
          fields={[{ name: "text", label: "Question", required: true, wide: true }, { name: "sortOrder", label: "Order", type: "number" }, { name: "active", label: "Active", type: "checkbox" }]} />}
      </div>
      <p className="text-xs text-ink-500">Pricing rules, slabs and modules live on <a className="link" href="/catalogue">Products & pricing</a>. Sales targets on <a className="link" href="/performance">Team performance</a>. Users and teams on <a className="link" href="/admin/users">Users</a>.</p>
    </div>
  </>);
}
