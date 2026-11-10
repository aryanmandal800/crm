import { asc, isNull } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { allSettings } from "@/lib/settings";
import { settingFields } from "@/lib/settingsForm";
import { inr } from "@/lib/format";
import { Badge, Card, PageHeader, Table } from "@/components/ui";
import { JsonForm } from "@/components/client/JsonForm";
import { Disclosure } from "@/components/client/Disclosure";
import { PricingCalculator } from "@/components/client/PricingCalculator";

export const dynamic = "force-dynamic";
const moduleFields = [
  { name: "key", label: "Key", required: true }, { name: "name", label: "Name", required: true },
  { name: "category", label: "Category", type: "select" as const, required: true, options: ["CORE", "DIGITAL", "INTEGRATION", "SERVICE"].map((v) => ({ value: v, label: v })) },
  { name: "pricingType", label: "Pricing type", type: "select" as const, required: true, options: ["INCLUDED", "PER_MEMBER", "FLAT_MONTHLY", "PER_BRANCH", "ONE_TIME"].map((v) => ({ value: v, label: v })) },
  { name: "price", label: "Price (₹)", type: "number" as const, required: true }, { name: "isCore", label: "Part of core bundle", type: "checkbox" as const }, { name: "active", label: "Active", type: "checkbox" as const },
  { name: "description", label: "Description", type: "textarea" as const }, { name: "notes", label: "Notes (e.g. provider, assumption)", type: "textarea" as const },
];

export default async function Catalogue({ searchParams }: { searchParams: Promise<{ members?: string; branches?: string }> }) {
  const ctx = await requirePage("pricing.view", "pricing.config"); const sp = await searchParams;
  const [mods, slabs, s, leads] = await Promise.all([
    db.select().from(t.productModules).orderBy(asc(t.productModules.sortOrder)),
    db.select().from(t.pricingSlabs).orderBy(asc(t.pricingSlabs.minMembers)),
    allSettings(),
    db
      .select({
        id: t.institutions.id,
        legalName: t.institutions.legalName,
        leadCode: t.institutions.leadCode,
        members: t.institutions.totalMembers,
        branches: t.institutions.branchCount,
      })
      .from(t.institutions)
      .where(isNull(t.institutions.deletedAt))
      .orderBy(asc(t.institutions.legalName))
      .limit(200),
  ]);
  const cfg = ctx.can("pricing.config") && !ctx.grant;
  const pf = settingFields("PRICING", s);
  return (<>
    <PageHeader title="Product & pricing catalogue" sub="All prices are editable assumptions — not verified market rates. Third-party costs are billed at actuals." />
    <Card title="Interactive Pricing Calculator & Quotation Studio" className="mb-4">
      <PricingCalculator
        members={Number(sp.members || 5000)}
        branches={Number(sp.branches || 3)}
        institutions={leads}
        modules={mods.filter((m) => m.active).map((m) => ({
          value: m.key,
          label: m.name,
          category: m.category,
          price: m.price,
          pricingType: m.pricingType,
          description: m.description,
          isCore: m.isCore,
        }))}
      />
    </Card>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Member slabs (₹/member/month)">
        <Table head={["Members", "Rate"]}>{slabs.map((x) => <tr key={x.id}><td className="td">{x.label ?? `${x.minMembers}–${x.maxMembers ?? "∞"}`}</td><td className="td">₹{x.ratePerMember}</td></tr>)}</Table>
        <p className="mt-2 text-xs text-ink-500">List ₹{String(s.get("pricing.listRate"))} · floor ₹{String(s.get("pricing.floorRate"))} (below floor needs approval) · minimum monthly {inr(Number(s.get("pricing.minMonthly")))}</p>
        {cfg && <Disclosure label="Edit slabs"><JsonForm action="/api/catalogue/slabs" method="PUT" cols={1} fields={[{ name: "slabs", label: "Slabs", type: "json", help: "Contiguous from 0; last slab maxMembers null." }]}
          initial={{ slabs: slabs.map(({ minMembers, maxMembers, ratePerMember, label }) => ({ minMembers, maxMembers, ratePerMember, label })) }} /></Disclosure>}
      </Card>
      <Card title="Commercial rules">
        {cfg ? <Disclosure label="Edit pricing assumptions & rules"><JsonForm action="/api/settings" method="PATCH" fields={pf.fields} initial={pf.initial} /></Disclosure>
          : <dl className="space-y-1 text-sm">{pf.fields.filter((f) => f.type === "number").map((f) => <div key={f.name} className="flex justify-between"><dt className="text-ink-500">{f.label}</dt><dd>{String(pf.initial[f.name])}</dd></div>)}</dl>}
      </Card>
    </div>
    <Card title={`Modules & Pricing Catalogue (${mods.length} CBS Modules)`} className="mt-4">
      <Table head={["#", "Module", "Category", "Monthly Price", "Description", ""]}>
        {mods.map((m) => <tr key={m.id}>
          <td className="td text-xs font-mono text-ink-400 w-12 font-semibold">#{String((m.sortOrder ?? 0) + 1).padStart(2, "0")}</td>
          <td className="td"><b>{m.name}</b><div className="text-xs text-ink-500 font-mono">{m.key}</div></td>
          <td className="td text-xs">{m.category}{m.isCore && <> <Badge v="HIGH">core</Badge></>}{!m.active && <> <Badge v="LOW">inactive</Badge></>}</td>
          <td className="td text-xs font-semibold text-brand-700 whitespace-nowrap">{m.pricingType === "INCLUDED" ? "Included in Base" : `${inr(m.price)} / mo`}</td>
          <td className="td text-xs text-ink-600 max-w-md">{m.description || m.notes}</td>
          <td className="td">{cfg && <Disclosure label="Edit"><JsonForm action={`/api/catalogue/modules/${m.id}`} method="PATCH" fields={moduleFields} initial={m} /></Disclosure>}</td></tr>)}
      </Table>
      {cfg && <Disclosure label="Add module"><JsonForm action="/api/catalogue/modules" fields={moduleFields} initial={{ category: "DIGITAL", pricingType: "FLAT_MONTHLY", price: 5000, active: true }} /></Disclosure>}
    </Card>
  </>);
}
