import { api } from "@/lib/api";
import { findDuplicates } from "@/lib/leads";
export const GET = api(["lead.create", "lead.edit"], async (_ctx, req) => {
  const p = req.nextUrl.searchParams;
  return findDuplicates({ legalName: p.get("name") ?? "", regNumber: p.get("reg"), talukaId: p.get("taluka"), excludeId: p.get("exclude") ?? undefined });
});
