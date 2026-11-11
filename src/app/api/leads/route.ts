import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable, canAssignTo } from "@/lib/access";
import { audit } from "@/lib/audit";
import { forbidden } from "@/lib/errors";
import { dedupeKey, findDuplicates, institutionInput, nextLeadCode } from "@/lib/leads";
import { rescore } from "@/lib/scoring";
import { z } from "zod";

export const POST = api(["lead.create"], async (ctx) => {
  assertWritable(ctx);
  const b = await ctx.json(institutionInput.extend({ force: z.boolean().optional() }));
  const { force, ...data } = b;
  if (!force) {
    const d = await findDuplicates({ legalName: data.legalName, regNumber: data.regNumber, talukaId: data.talukaId });
    if (d.exact.length || d.fuzzy.length) return { duplicates: d, needsConfirm: true };
  }
  // Ownership: assigners can pick within scope; everyone else becomes owner of what they create (sales) or leaves it unassigned (research)
  let ownerId = data.ownerId ?? null;
  if (ownerId && !canAssignTo(ctx, ownerId)) throw forbidden("You cannot assign leads to that user");
  if (!ownerId && ctx.scope === "OWN") ownerId = ctx.user.id;
  if (data.manualScores && !ctx.can("research.edit")) delete data.manualScores;
  let districtId = data.districtId ?? null;
  if (districtId) {
    const [d] = await db.select({ launched: t.districts.launched }).from(t.districts).where(eq(t.districts.id, districtId));
    if (!d) districtId = null;
  }
  const [row] = await db.insert(t.institutions).values({
    ...data,
    status: data.status || "UNKNOWN",
    contactVerification: data.contactVerification || "UNVERIFIED",
    hosting: data.hosting || "UNKNOWN",
    vendorClass: data.vendorClass || "UNKNOWN",
    verification: data.verification || "UNVERIFIED",
    dataConfidence: data.dataConfidence || "LOW",
    mobileApp: data.mobileApp || "UNKNOWN",
    internetBanking: data.internetBanking || "UNKNOWN",
    upiIntegration: data.upiIntegration || "UNKNOWN",
    digitalLoans: data.digitalLoans || "UNKNOWN",
    ekyc: data.ekyc || "UNKNOWN",
    centralisedCbs: data.centralisedCbs || "UNKNOWN",
    shariahInterest: data.shariahInterest ?? false,
    districtId,
    ownerId,
    leadCode: await nextLeadCode(districtId),
    dedupeKey: dedupeKey(data.legalName),
    researchedById: ctx.user.id,
  } as any).returning();
  if (data.authorizedPersonName) {
    await db.insert(t.contacts).values({
      institutionId: row.id,
      name: data.authorizedPersonName,
      designation: data.authorizedPersonDesignation ?? "Authorized Person",
      role: "OTHER",
      businessPhone: data.authorizedPersonPhone ?? null,
      businessEmail: data.authorizedPersonEmail ?? null,
      isDecisionMaker: true,
      verification: "UNVERIFIED",
      notes: "Primary discussion contact / authorized person entered during lead creation.",
    });
  }
  await rescore([row.id]);
  await audit(ctx, "create", "institution", row.id, null, {
    legalName: row.legalName,
    leadCode: row.leadCode,
    authorizedPerson: data.authorizedPersonName ?? null,
  });
  return { id: row.id, leadCode: row.leadCode };
});
