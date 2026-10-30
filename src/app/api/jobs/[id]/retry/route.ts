import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { audit } from "@/lib/audit";
export const POST = api<{ id: string }>(["tech.dashboard"], async (ctx, _r, { id }) => {
  await db.update(t.jobs).set({ status: "QUEUED", runAt: new Date(), lastError: null }).where(eq(t.jobs.id, id));
  await audit(ctx, "retry_job", "job", id); return { id };
});
