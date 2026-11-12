import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { WorkTracker } from "@/components/client/WorkTracker";

export const dynamic = "force-dynamic";

export default async function WorkTrackerPage() {
  const ctx = await requirePage();

  const isCeo = Boolean(ctx.user.isFounder || ctx.role.key === "SUPER_ADMIN" || ctx.can("dashboard.founder"));
  const userDepartment: "BDM" | "TECH" | "ALL" = isCeo
    ? "ALL"
    : ctx.role.key === "TECH_ADMIN" || ctx.role.key.includes("TECH")
    ? "TECH"
    : "BDM";

  const allUsers = await db.query.users.findMany({
    where: eq(t.users.active, true),
    with: { role: true },
  });

  // Filter users visible in the tracker based on department & role
  // Tech only sees Tech team, BDM only sees BDM team, CEO sees all
  const filteredUsers = allUsers.filter((u) => {
    if (isCeo) return true;
    const isUserTech = u.role.key === "TECH_ADMIN" || u.role.key.includes("TECH");
    if (userDepartment === "TECH") return isUserTech;
    if (userDepartment === "BDM") return !isUserTech && !u.isFounder && u.role.key !== "SUPER_ADMIN";
    return true;
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
        isCeo,
        userDepartment,
      }}
      users={filteredUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: { key: u.role.key, name: u.role.name },
      }))}
      institutions={institutions}
    />
  );
}
