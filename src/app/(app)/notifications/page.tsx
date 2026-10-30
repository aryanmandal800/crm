import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { dtt } from "@/lib/format";
import { Card, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client/ActionButton";
export const dynamic = "force-dynamic";
export default async function Notifications() {
  const ctx = await requirePage();
  const rows = await db.select().from(t.notifications).where(and(eq(t.notifications.userId, ctx.user.id), eq(t.notifications.channel, "IN_APP"))).orderBy(desc(t.notifications.createdAt)).limit(100);
  return (<>
    <PageHeader title="Notifications" actions={<ActionButton url="/api/notifications/read" label="Mark all read" />} />
    <Card>{rows.map((n) => <div key={n.id} className={`border-b border-ink-100 py-2 text-sm ${n.readAt ? "" : "font-medium"}`}>
      {n.link ? <Link className="hover:text-brand-600" href={n.link}>{n.title}</Link> : n.title}{!n.readAt && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-brand-500" />}
      {n.body && <p className="text-xs font-normal text-ink-700">{n.body}</p>}<div className="text-xs font-normal text-ink-500">{dtt(n.createdAt)}</div></div>)}
      {!rows.length && <p className="muted">No notifications.</p>}</Card>
  </>);
}
