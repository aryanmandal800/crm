import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { WorkTracker } from "@/components/client/WorkTracker";

export const dynamic = "force-dynamic";

export default async function WorkTrackerPage() {
  const ctx = await requirePage();

  const users = await db.query.users.findMany({
    where: eq(t.users.active, true),
    with: { role: true },
  });

  const institutions = await db.query.institutions.findMany({
    columns: { id: true, legalName: true },
    limit: 150,
  });

  return (
    <WorkTracker
      currentUser={{
        id: ctx.user.id,
        name: ctx.user.name,
        email: ctx.user.email,
        role: ctx.role.key,
        isFounder: ctx.user.isFounder,
      }}
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: { key: u.role.key, name: u.role.name },
      }))}
      institutions={institutions}
    />
  );
}

