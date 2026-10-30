import { desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { dtt } from "@/lib/format";
import { Badge, Card, PageHeader, Table } from "@/components/ui";
import { JsonForm } from "@/components/client/JsonForm";
import { ActionButton } from "@/components/client/ActionButton";
export const dynamic = "force-dynamic";
export default async function Grants() {
  await requirePage("grants.manage");
  const rows = await db.select({ g: t.dataAccessGrants, user: t.users.name }).from(t.dataAccessGrants).innerJoin(t.users, eq(t.users.id, t.dataAccessGrants.userId)).orderBy(desc(t.dataAccessGrants.createdAt)).limit(100);
  const techUsers = await db.select({ id: t.users.id, name: t.users.name }).from(t.users).innerJoin(t.roles, eq(t.roles.id, t.users.roleId)).where(eq(t.roles.key, "TECH_ADMIN"));
  const now = new Date();
  return (<>
    <PageHeader title="Data-access grants" sub="The Technical Administrator cannot see or export business data unless you grant time-boxed, read-only access here (e.g. to debug a data issue). Everything they view or export is audit-logged." />
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="card lg:col-span-2"><Table head={["User", "Scope", "Reason", "Expires", "Status", ""]} empty={!rows.length}>
        {rows.map(({ g, user }) => { const active = !g.revokedAt && g.expiresAt > now; return <tr key={g.id}><td className="td">{user}</td><td className="td text-xs">{g.scope}</td><td className="td text-xs">{g.reason}</td><td className="td text-xs">{dtt(g.expiresAt)}</td>
          <td className="td">{active ? <Badge v="PENDING">active</Badge> : <Badge v="LOW">{g.revokedAt ? "revoked" : "expired"}</Badge>}</td><td className="td">{active && <ActionButton url={`/api/grants/${g.id}`} method="DELETE" label="Revoke" />}</td></tr>; })}
      </Table></div>
      <Card title="Grant access"><JsonForm action="/api/grants" cols={1} fields={[{ name: "userId", label: "User", type: "select", required: true, options: techUsers.map((u) => ({ value: u.id, label: u.name })) },
        { name: "hours", label: "Hours (max 72)", type: "number", required: true }, { name: "scope", label: "Scope", type: "select", required: true, options: [{ value: "READ", label: "Read only" }, { value: "READ_EXPORT", label: "Read + export" }] },
        { name: "reason", label: "Operational reason", type: "textarea", required: true }]} initial={{ hours: 4, scope: "READ" }} submitLabel="Grant" /></Card>
    </div>
  </>);
}
