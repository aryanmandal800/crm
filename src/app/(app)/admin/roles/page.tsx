import { asc } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { PERMISSIONS, SUPER_ADMIN_ONLY } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui";
import { JsonForm } from "@/components/client/JsonForm";
import { Disclosure } from "@/components/client/Disclosure";
export const dynamic = "force-dynamic";
export default async function Roles() {
  await requirePage("roles.manage");
  const roles = await db.select().from(t.roles).orderBy(asc(t.roles.name));
  const grantable = Object.entries(PERMISSIONS).filter(([k]) => !SUPER_ADMIN_ONLY.includes(k as any)).map(([value, label]) => ({ value, label: `${value} — ${label}` }));
  return (<>
    <PageHeader title="Roles & permissions" sub="Enforced on the server for every page and API call. Permissions marked reserved can only belong to the Super Admin role." />
    <div className="space-y-4">{roles.map((r) => (
      <Card key={r.id} title={r.name} actions={<span className="text-xs text-ink-500">{r.key}</span>}>
        <p className="muted mb-2">{r.description}</p>
        <div className="flex flex-wrap gap-1">{r.permissions.map((p) => <span key={p} className={`rounded px-1.5 py-0.5 text-[11px] ${SUPER_ADMIN_ONLY.includes(p as any) ? "bg-violet-100 text-violet-800" : "bg-ink-100"}`}>{p}</span>)}</div>
        {r.key !== "SUPER_ADMIN" && <Disclosure label="Edit permissions"><JsonForm action={`/api/roles/${r.id}`} method="PATCH" cols={1} fields={[{ name: "name", label: "Name" }, { name: "description", label: "Description", type: "textarea" }, { name: "permissions", label: "Permissions", type: "multiselect", options: grantable }]} initial={r} /></Disclosure>}
      </Card>))}
      <Card title="Add a role (e.g. Regional Manager)"><JsonForm action="/api/roles" cols={1} fields={[{ name: "key", label: "Key (CAPITALS)", required: true }, { name: "name", label: "Name", required: true }, { name: "description", label: "Description", type: "textarea" }, { name: "permissions", label: "Permissions", type: "multiselect", options: grantable }]} initial={{ permissions: [] }} /></Card>
      <Card title="Reserved for Super Admin"><ul className="list-disc pl-5 text-sm">{SUPER_ADMIN_ONLY.map((p) => <li key={p}><b>{p}</b> — {PERMISSIONS[p]}</li>)}</ul></Card>
    </div>
  </>);
}
