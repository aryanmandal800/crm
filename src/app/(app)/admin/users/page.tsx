import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { dtt } from "@/lib/format";
import { Badge, Card, PageHeader, Table } from "@/components/ui";
import { JsonForm } from "@/components/client/JsonForm";
import { Disclosure } from "@/components/client/Disclosure";
import { ActionButton } from "@/components/client/ActionButton";
export const dynamic = "force-dynamic";
export default async function Users() {
  const ctx = await requirePage("users.manage", "users.support");
  const [rows, roles, teams] = await Promise.all([
    db.select({ u: t.users, role: t.roles.name, roleKey: t.roles.key, team: t.teams.name }).from(t.users).innerJoin(t.roles, eq(t.roles.id, t.users.roleId)).leftJoin(t.teams, eq(t.teams.id, t.users.teamId)).orderBy(asc(t.users.name)),
    db.select().from(t.roles).orderBy(asc(t.roles.name)), db.select().from(t.teams).orderBy(asc(t.teams.name))]);
  const manage = ctx.can("users.manage");
  const roleOpts = roles.filter((r) => r.key !== "SUPER_ADMIN" || ctx.user.isFounder).map((r) => ({ value: r.id, label: r.name }));
  const teamOpts = teams.map((x) => ({ value: x.id, label: x.name }));
  return (<>
    <PageHeader title="Users & teams" sub="Temporary passwords are shown once and must be changed at first sign-in. Disabling a user or changing their role signs them out immediately." />
    <div className="card mb-4"><Table head={["Name", "Role", "Team", "Status", "Last login", ""]}>
      {rows.map(({ u, role, roleKey, team }) => {
        const canSupport = !u.isFounder && u.id !== ctx.user.id && (manage || !["SUPER_ADMIN", "TECH_ADMIN"].includes(roleKey));
        const canEdit = manage && (!u.isFounder || ctx.user.isFounder) && (roleKey !== "SUPER_ADMIN" || ctx.user.isFounder);
        return (<tr key={u.id}><td className="td"><b>{u.name}</b>{u.isFounder && <> <Badge v="AI">Founder</Badge></>}<div className="text-xs text-ink-500">{u.email}</div></td><td className="td text-sm">{role}</td><td className="td text-sm">{team ?? "—"}</td>
          <td className="td">{u.active ? <Badge v="SUCCESS">active</Badge> : <Badge v="FAILED">disabled</Badge>}{u.lockedUntil && u.lockedUntil > new Date() && <> <Badge v="PENDING">locked</Badge></>}{u.mustChangePassword && <div className="text-[11px] text-ink-500">must change password</div>}</td>
          <td className="td text-xs">{dtt(u.lastLoginAt)}</td>
          <td className="td">{canSupport && <ActionButton url={`/api/users/${u.id}/reset`} label="Reset password" confirm={`Reset ${u.name}'s password? Their sessions will end.`} className="btn-ghost px-2 py-1 text-xs" />}
            {canEdit && <Disclosure label="Edit"><JsonForm action={`/api/users/${u.id}`} method="PATCH" cols={1} fields={[{ name: "name", label: "Name", required: true }, { name: "phone", label: "Phone" },
              ...(u.isFounder ? [] : [{ name: "roleId", label: "Role", type: "select" as const, required: true, options: roleOpts }, { name: "active", label: "Active", type: "checkbox" as const }]),
              { name: "teamId", label: "Team", type: "select", options: teamOpts }]} initial={u} /></Disclosure>}</td></tr>);
      })}
    </Table></div>
    {manage && <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Add user"><JsonForm action="/api/users" cols={1} fields={[{ name: "name", label: "Name", required: true }, { name: "email", label: "Email", type: "email", required: true }, { name: "phone", label: "Phone" },
        { name: "roleId", label: "Role", type: "select", required: true, options: roleOpts }, { name: "teamId", label: "Team", type: "select", options: teamOpts }]} initial={{ roleId: roles.find((r) => r.key === "SALES_EXEC")?.id }} submitLabel="Create user" /></Card>
      <Card title="Teams">{teams.map((tm) => <div key={tm.id} className="border-b border-ink-100 py-1 text-sm"><b>{tm.name}</b> <span className="text-xs text-ink-500">{tm.region} · manager {rows.find((r) => r.u.id === tm.managerId)?.u.name ?? "—"}</span>
        <Disclosure label="Edit"><JsonForm action={`/api/taxonomy/teams/${tm.id}`} method="PATCH" cols={1} fields={[{ name: "name", label: "Name", required: true }, { name: "region", label: "Region" }, { name: "managerId", label: "Manager", type: "select", options: rows.map((r) => ({ value: r.u.id, label: r.u.name })) }]} initial={tm} /></Disclosure></div>)}
        <Disclosure label="Add team"><JsonForm action="/api/taxonomy/teams" cols={1} fields={[{ name: "name", label: "Name", required: true }, { name: "region", label: "Region" }, { name: "managerId", label: "Manager", type: "select", options: rows.map((r) => ({ value: r.u.id, label: r.u.name })) }]} /></Disclosure></Card>
    </div>}
  </>);
}
