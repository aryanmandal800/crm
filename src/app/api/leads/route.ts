import { and, asc, desc, eq, ilike, or, sql, SQL } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable, canAssignTo, instScope } from "@/lib/access";
import { audit } from "@/lib/audit";
import { forbidden } from "@/lib/errors";
import { dedupeKey, findDuplicates, institutionInput, nextLeadCode } from "@/lib/leads";
import { rescore } from "@/lib/scoring";
import { z } from "zod";

export const GET = api(["lead.view.all", "lead.view.team", "lead.view.own"], async (ctx, req) => {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q");
  const taluka = sp.get("taluka");
  const type = sp.get("type");
  const band = sp.get("band");
  const category = sp.get("category");
  const verification = sp.get("verification");
  const owner = sp.get("owner");
  const segment = sp.get("segment");
  const vendor = sp.get("vendor");
  const tag = sp.get("tag");
  const sort = sp.get("sort");
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit") ?? 50)));
  const offset = (page - 1) * limit;

  const conds: (SQL | undefined)[] = [instScope(ctx)];
  if (q) conds.push(or(ilike(t.institutions.legalName, `%${q}%`), ilike(t.institutions.shortName, `%${q}%`), ilike(t.institutions.leadCode, `%${q}%`), ilike(t.institutions.regNumber, `%${q}%`), ilike(t.institutions.city, `%${q}%`)));
  if (taluka) conds.push(eq(t.institutions.talukaId, taluka));
  if (type) conds.push(eq(t.institutions.typeId, type));
  if (band) conds.push(eq(t.institutions.scoreBand, band as any));
  if (category) conds.push(eq(t.institutions.opportunityCategory, category));
  if (verification) conds.push(eq(t.institutions.verification, verification as any));
  if (owner === "me") conds.push(eq(t.institutions.ownerId, ctx.user.id));
  else if (owner === "none") conds.push(sql`${t.institutions.ownerId} is null`);
  else if (owner) conds.push(eq(t.institutions.ownerId, owner));
  if (segment === "primary") conds.push(sql`${t.institutionTypes.isPrimary}`);
  if (segment === "expansion") conds.push(sql`not ${t.institutionTypes.isPrimary}`);
  if (vendor) conds.push(eq(t.institutions.vendorClass, vendor as any));
  if (tag) conds.push(sql`${tag} = any(${t.institutions.tags})`);
  const where = and(...conds);

  const orderBy =
    sort === "score"
      ? desc(t.institutions.score)
      : sort === "name"
      ? asc(t.institutions.legalName)
      : sort === "members"
      ? sql`${t.institutions.totalMembers} desc nulls last`
      : sort === "oldest"
      ? asc(t.institutions.createdAt)
      : desc(t.institutions.createdAt);

  const [countRes] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(t.institutions)
    .innerJoin(t.institutionTypes, eq(t.institutions.typeId, t.institutionTypes.id))
    .where(where);

  const rows = await db
    .select({
      id: t.institutions.id,
      leadCode: t.institutions.leadCode,
      legalName: t.institutions.legalName,
      shortName: t.institutions.shortName,
      city: t.institutions.city,
      score: t.institutions.score,
      scoreBand: t.institutions.scoreBand,
      verification: t.institutions.verification,
      status: t.institutions.status,
      opportunityCategory: t.institutions.opportunityCategory,
      totalMembers: t.institutions.totalMembers,
      activeMembers: t.institutions.activeMembers,
      branchCount: t.institutions.branchCount,
      cbsVendor: t.institutions.cbsVendor,
      vendorClass: t.institutions.vendorClass,
      ownerId: t.institutions.ownerId,
      ownerName: t.users.name,
      typeName: t.institutionTypes.name,
      typeKey: t.institutionTypes.key,
      isPrimary: t.institutionTypes.isPrimary,
      talukaName: t.talukas.name,
      districtName: t.districts.name,
      createdAt: t.institutions.createdAt,
    })
    .from(t.institutions)
    .innerJoin(t.institutionTypes, eq(t.institutions.typeId, t.institutionTypes.id))
    .leftJoin(t.talukas, eq(t.institutions.talukaId, t.talukas.id))
    .leftJoin(t.districts, eq(t.institutions.districtId, t.districts.id))
    .leftJoin(t.users, eq(t.institutions.ownerId, t.users.id))
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    leads: rows,
    total: countRes?.total ?? 0,
    page,
    limit,
    totalPages: Math.ceil((countRes?.total ?? 0) / limit),
  };
});

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
