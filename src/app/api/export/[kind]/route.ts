import { and, desc, eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { activityScope, dealScope, instScope } from "@/lib/access";
import { audit } from "@/lib/audit";
import { bad } from "@/lib/errors";
import { toCsv, toXlsx, type Sheet } from "@/lib/export";
import { ownerFilter, salesPerformance, talukaCoverage } from "@/lib/metrics";
import { allSettings } from "@/lib/settings";

const KINDS = ["leads", "activities", "pipeline", "forecast", "performance", "talukas", "pricing", "lost"] as const;

export const GET = api<{ kind: string }>(["reports.export"], async (ctx, req, { kind }) => {
  if (!KINDS.includes(kind as any)) throw bad("Unknown export");
  const fmt = req.nextUrl.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  let sheets: Sheet[] = [];
  if (kind === "leads") {
    const rows = await db.select({
      leadCode: t.institutions.leadCode, legalName: t.institutions.legalName, shortName: t.institutions.shortName, type: t.institutionTypes.name, primarySegment: t.institutionTypes.isPrimary,
      regNumber: t.institutions.regNumber, taluka: t.talukas.name, city: t.institutions.city, pinCode: t.institutions.pinCode, address: t.institutions.address,
      landline: t.institutions.landline, mobile: t.institutions.mobile, email: t.institutions.email, website: t.institutions.website,
      totalMembers: t.institutions.totalMembers, branches: t.institutions.branchCount, deposits: t.institutions.totalDeposits, cbsVendor: t.institutions.cbsVendor, vendorClass: t.institutions.vendorClass,
      mobileApp: t.institutions.mobileApp, ekyc: t.institutions.ekyc, upi: t.institutions.upiIntegration, score: t.institutions.score, band: t.institutions.scoreBand,
      opportunity: t.institutions.opportunityCategory, missingInfo: t.institutions.missingInfo, verification: t.institutions.verification, confidence: t.institutions.dataConfidence,
      owner: t.users.name, lastVerified: t.institutions.lastVerifiedAt, created: t.institutions.createdAt,
    }).from(t.institutions).innerJoin(t.institutionTypes, eq(t.institutionTypes.id, t.institutions.typeId)).leftJoin(t.talukas, eq(t.talukas.id, t.institutions.talukaId))
      .leftJoin(t.users, eq(t.users.id, t.institutions.ownerId)).where(instScope(ctx)).orderBy(desc(t.institutions.score));
    sheets = [{ name: "Leads", rows }];
  } else if (kind === "activities") {
    const rows = await db.select({ when: t.activities.occurredAt, type: t.activities.typeKey, status: t.activities.status, institution: t.institutions.legalName, by: t.users.name, contact: t.contacts.name,
      outcome: t.activities.outcome, dmReached: t.activities.decisionMakerReached, meaningful: t.activities.meaningful, notes: t.activities.notes, objection: t.activities.objection,
      nextAction: t.activities.nextAction, followUp: t.activities.followUpDate }).from(t.activities).innerJoin(t.institutions, eq(t.institutions.id, t.activities.institutionId))
      .innerJoin(t.users, eq(t.users.id, t.activities.userId)).leftJoin(t.contacts, eq(t.contacts.id, t.activities.contactId)).where(activityScope(ctx)).orderBy(desc(t.activities.occurredAt)).limit(50000);
    sheets = [{ name: "Activities", rows }];
  } else if (kind === "pipeline" || kind === "forecast" || kind === "lost") {
    const rows = await db.select({ deal: t.deals.title, institution: t.institutions.legalName, stage: t.pipelineStages.name, open: t.pipelineStages.isOpen, owner: t.users.name,
      opportunity: t.deals.opportunityCategory, mrr: t.deals.mrr, implementation: t.deals.implementationFee, probability: sql<number>`coalesce(${t.deals.probabilityOverride}, ${t.pipelineStages.probability})`,
      weightedMrr: sql<number>`(${t.deals.mrr} * coalesce(${t.deals.probabilityOverride}, ${t.pipelineStages.probability}) / 100.0)::float`, expectedClose: t.deals.expectedCloseDate,
      nextAction: t.deals.nextAction, followUp: t.deals.followUpDate, wonAt: t.deals.wonAt, lostAt: t.deals.lostAt, lostReason: t.lostReasons.name, lostNotes: t.deals.lostNotes, competitor: t.competitors.name })
      .from(t.deals).innerJoin(t.institutions, eq(t.institutions.id, t.deals.institutionId)).innerJoin(t.pipelineStages, eq(t.pipelineStages.id, t.deals.stageId)).innerJoin(t.users, eq(t.users.id, t.deals.ownerId))
      .leftJoin(t.lostReasons, eq(t.lostReasons.id, t.deals.lostReasonId)).leftJoin(t.competitors, eq(t.competitors.id, t.deals.competitorId)).where(dealScope(ctx)).orderBy(desc(t.deals.mrr));
    if (kind === "pipeline") sheets = [{ name: "Pipeline", rows }];
    else if (kind === "lost") sheets = [{ name: "Lost deals", rows: rows.filter((r) => r.lostAt) }];
    else {
      const open = rows.filter((r) => r.open); const byMonth = new Map<string, { month: string; deals: number; mrr: number; weightedMrr: number }>();
      for (const r of open) { const m = r.expectedClose ? r.expectedClose.toISOString().slice(0, 7) : "No date"; const e = byMonth.get(m) ?? { month: m, deals: 0, mrr: 0, weightedMrr: 0 }; e.deals++; e.mrr += r.mrr; e.weightedMrr += r.weightedMrr; byMonth.set(m, e); }
      sheets = [{ name: "Forecast by month", rows: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)) }, { name: "Open deals", rows: open },
        { name: "Won", rows: rows.filter((r) => r.wonAt).map((r) => ({ institution: r.institution, mrr: r.mrr, wonAt: r.wonAt })) }];
    }
  } else if (kind === "performance") {
    const since = new Date(Date.now() - Number(req.nextUrl.searchParams.get("days") ?? 30) * 864e5);
    sheets = [{ name: "Performance", rows: await salesPerformance(ownerFilter(ctx), since) }];
  } else if (kind === "talukas") {
    sheets = [{ name: "Taluka coverage", rows: (await talukaCoverage(ownerFilter(ctx))).map(({ id, ...r }) => r) }];
  } else if (kind === "pricing") {
    const s = await allSettings();
    sheets = [{ name: "Modules", rows: await db.select({ key: t.productModules.key, name: t.productModules.name, category: t.productModules.category, pricingType: t.productModules.pricingType, price: t.productModules.price, active: t.productModules.active, notes: t.productModules.notes }).from(t.productModules) },
      { name: "Slabs", rows: await db.select({ min: t.pricingSlabs.minMembers, max: t.pricingSlabs.maxMembers, rate: t.pricingSlabs.ratePerMember }).from(t.pricingSlabs) },
      { name: "Rules", rows: [...s.entries()].filter(([k]) => k.startsWith("pricing.")).map(([key, value]) => ({ key, value })) },
      { name: "Quotes", rows: await db.select({ number: t.quotes.number, institution: t.institutions.legalName, status: t.quotes.status, model: t.quotes.model, members: t.quotes.members, monthly: t.quotes.monthlyFee, discountPct: t.quotes.discountPct, oneTime: t.quotes.implementationFee, created: t.quotes.createdAt }).from(t.quotes).innerJoin(t.institutions, eq(t.institutions.id, t.quotes.institutionId)).where(instScope(ctx)) }];
  }
  await audit(ctx, "export", "report", kind, null, { format: fmt, rows: sheets.reduce((a, s) => a + s.rows.length, 0), grant: !!ctx.grant });
  const stamp = new Date().toISOString().slice(0, 10);
  if (fmt === "csv") return new Response(toCsv(sheets[0].rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="fivopay-${kind}-${stamp}.csv"` } });
  const buf = await toXlsx(sheets, `Fivopay CRM export: ${kind} — by ${ctx.user.name}`);
  return new Response(new Uint8Array(buf), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="fivopay-${kind}-${stamp}.xlsx"` } });
});
