import { and, eq, isNull, sql } from "drizzle-orm";
import { requirePage } from "@/lib/auth";
import { navFor } from "@/lib/nav";
import { Nav } from "@/components/client/Nav";
import { db, t } from "@/db";
import { dt } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePage();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(t.notifications).where(and(eq(t.notifications.userId, ctx.user.id), isNull(t.notifications.readAt)));
  return (
    <div className="min-h-screen">
      <Nav items={navFor(ctx)} user={{ name: ctx.user.name, role: ctx.role.name, grant: ctx.grant ? dt(ctx.grant.expiresAt) : null }} unread={n} />
      <main className="px-4 py-5 sm:px-6 lg:ml-60 lg:px-8 lg:py-7"><div className="mx-auto max-w-7xl">{children}</div></main>
    </div>
  );
}
