import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { audit } from "@/lib/audit";
export const DELETE = api<{ id: string }>(["grants.manage"], async (ctx, _r, { id }) => {
  await db.update(t.dataAccessGrants).set({ revokedAt: new Date() }).where(eq(t.dataAccessGrants.id, id));
  await audit(ctx, "revoke_data_access", "grant", id); return { id };
});
