import { eq, inArray, isNull, and, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable } from "@/lib/access";
import { audit } from "@/lib/audit";
import { dedupeKey } from "@/lib/leads";
import { rescore } from "@/lib/scoring";

/**
 * Bulk import (CSV parsed in the browser, sent in chunks of ≤1000 rows).
 * mode=preview → validation + duplicate report, nothing written. mode=commit → inserts non-duplicates.
 * Every imported row gets a Source record (name/URL/date) so provenance is never lost.
 */
const row = z.record(z.string(), z.any());
const body = z.object({
  mode: z.enum(["preview", "commit"]), districtId: z.string().uuid(), defaultTypeKey: z.string().optional(),
  sourceName: z.string().trim().min(3, "Source name is required (e.g. 'ARCS Pune directory')"), sourceUrl: z.string().url().optional().nullable(),
  accessedAt: z.string().optional(), rows: z.array(row).min(1).max(1000), assignTo: z.string().uuid().optional().nullable(),
});

const toInt = (v: any) => { const n = Number(String(v ?? "").replace(/[, ]/g, "")); return v === "" || v == null || Number.isNaN(n) ? null : Math.round(n); };
const toStr = (v: any) => { const s = String(v ?? "").trim(); return s ? s.slice(0, 2000) : null; };

export const POST = api(["lead.import"], async (ctx) => {
  assertWritable(ctx);
  const b = await ctx.json(body);
  const [district] = await db.select().from(t.districts).where(eq(t.districts.id, b.districtId));
  if (!district) throw new Error("District not found");
  const talukas = await db.select().from(t.talukas).where(eq(t.talukas.districtId, district.id));
  const types = await db.select().from(t.institutionTypes);
  const findTaluka = (v: string | null) => {
    if (!v) return null; const k = v.toLowerCase().trim();
    return talukas.find((x) => x.name.toLowerCase() === k || x.aliases.some((a) => a.toLowerCase() === k))?.id ?? null;
  };
  const findType = (v: string | null) => {
    const k = (v ?? b.defaultTypeKey ?? "").toLowerCase().trim();
    return types.find((x) => x.key.toLowerCase() === k || x.name.toLowerCase() === k)?.id ?? null;
  };

  const errors: { row: number; error: string }[] = [];
  const prepared: any[] = [];
  b.rows.forEach((r, i) => {
    const legalName = toStr(r.legalName);
    if (!legalName || legalName.length < 3) return errors.push({ row: i + 1, error: "Missing legal name" });
    const typeId = findType(toStr(r.type));
    if (!typeId) return errors.push({ row: i + 1, error: `Unknown institution type '${r.type ?? b.defaultTypeKey ?? ""}'` });
    const talukaRaw = toStr(r.taluka);
    const talukaId = findTaluka(talukaRaw);
    if (talukaRaw && !talukaId) errors.push({ row: i + 1, error: `Unknown taluka '${talukaRaw}' — imported without taluka` });
    const pin = toStr(r.pinCode);
    prepared.push({
      legalName, typeId, talukaId, districtId: district.id, regNumber: toStr(r.regNumber), address: toStr(r.address), city: toStr(r.city),
      pinCode: pin && /^\d{6}$/.test(pin) ? pin : null, landline: toStr(r.landline), mobile: toStr(r.mobile), email: toStr(r.email), website: toStr(r.website),
      totalMembers: toInt(r.totalMembers), branchCount: toInt(r.branchCount), totalDeposits: toInt(r.totalDeposits), regAuthority: toStr(r.regAuthority),
      notes: toStr(r.notes), dedupeKey: dedupeKey(legalName), ownerId: b.assignTo ?? null, researchedById: ctx.user.id, _row: i + 1,
      _srcUrl: toStr(r.sourceUrl),
    });
  });

  // duplicates: within the file and against the database
  const seen = new Set<string>(); const dups: { row: number; legalName: string; reason: string }[] = [];
  const regs = prepared.map((p) => p.regNumber).filter(Boolean);
  const keys = prepared.map((p) => p.dedupeKey);
  const existing = await db.select({ regNumber: t.institutions.regNumber, dedupeKey: t.institutions.dedupeKey, talukaId: t.institutions.talukaId })
    .from(t.institutions).where(and(isNull(t.institutions.deletedAt), or(regs.length ? inArray(t.institutions.regNumber, regs) : sql`false`, inArray(t.institutions.dedupeKey, keys))));
  const fresh = prepared.filter((p) => {
    const k = `${p.dedupeKey}|${p.talukaId ?? ""}`;
    const dbHit = existing.find((e) => (p.regNumber && e.regNumber === p.regNumber) || (e.dedupeKey === p.dedupeKey && (e.talukaId ?? "") === (p.talukaId ?? "")));
    if (dbHit) { dups.push({ row: p._row, legalName: p.legalName, reason: p.regNumber && dbHit.regNumber === p.regNumber ? "Registration number exists" : "Same name in same taluka exists" }); return false; }
    if (seen.has(k) || (p.regNumber && seen.has(`reg:${p.regNumber}`))) { dups.push({ row: p._row, legalName: p.legalName, reason: "Duplicate within file" }); return false; }
    seen.add(k); if (p.regNumber) seen.add(`reg:${p.regNumber}`); return true;
  });

  if (b.mode === "preview") return { valid: fresh.length, duplicates: dups.length, errors, duplicateSample: dups.slice(0, 50) };

  let inserted = 0; const ids: string[] = [];
  if (fresh.length) {
    const { rows: seq } = await db.execute<{ n: string }>(sql`select nextval('lead_code_seq') as n from generate_series(1, ${fresh.length})`);
    const values = fresh.map((p, i) => { const { _row, _srcUrl, ...v } = p; return { ...v, leadCode: `FP-${district.code}-${String(seq[i].n).padStart(5, "0")}` }; });
    const out = await db.insert(t.institutions).values(values).returning({ id: t.institutions.id });
    ids.push(...out.map((o) => o.id)); inserted = out.length;
    const accessed = b.accessedAt ? new Date(b.accessedAt) : new Date();
    await db.insert(t.sources).values(out.map((o, i) => ({
      institutionId: o.id, name: b.sourceName, url: fresh[i]._srcUrl ?? b.sourceUrl ?? null, accessedAt: accessed,
      evidence: "Bulk import — directory listing", fieldKeys: ["legalName", "regNumber", "address", "taluka"], classification: "PUBLICLY_REPORTED" as const, addedById: ctx.user.id,
    })));
    if (inserted <= 300) await rescore(ids);
    else await db.insert(t.jobs).values({ type: "RESCORE", payload: { ids } });
  }
  await audit(ctx, "import", "institution", null, null, { inserted, duplicates: dups.length, errors: errors.length, source: b.sourceName });
  return { inserted, duplicates: dups.length, errors, message: `Imported ${inserted}; skipped ${dups.length} duplicates` };
});
