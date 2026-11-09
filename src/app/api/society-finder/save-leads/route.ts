import { z } from "zod";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable } from "@/lib/access";
import { audit } from "@/lib/audit";
import { dedupeKey } from "@/lib/leads";
import { rescore } from "@/lib/scoring";
import { findPin } from "@/lib/maharashtraPins";
import { inferStateFromPin, findIndiaLocation } from "@/lib/indiaGeography";

const placeSchema = z.object({
  id: z.string().optional(),
  displayName: z.object({ text: z.string() }).optional(),
  formattedAddress: z.string().optional().nullable(),
  addressComponents: z.array(z.any()).optional().nullable(),
  pinCode: z.string().optional().nullable(),
  entityType: z.enum(["CREDIT_SOCIETY", "HOUSING_SOCIETY", "BANK", "OTHER"]).optional(),
  nationalPhoneNumber: z.string().optional().nullable(),
  websiteUri: z.string().optional().nullable(),
  googleMapsUri: z.string().optional().nullable(),
  location: z.object({ latitude: z.number(), longitude: z.number() }).optional().nullable()
});

const bodySchema = z.object({
  places: z.array(placeSchema).min(1).max(200),
  targetPin: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional()
});

export const POST = api(null, async (ctx) => {
  assertWritable(ctx);
  const body = await ctx.json(bodySchema);

  const districts = await db.select().from(t.districts);
  const talukas = await db.select().from(t.talukas);
  const types = await db.select().from(t.institutionTypes);

  function resolveTypeId(entityType?: string, name?: string): string {
    const n = (name || "").toLowerCase();
    if (entityType === "HOUSING_SOCIETY") {
      const h = types.find((t) => t.key === "HOUSING");
      if (h) return h.id;
    }
    if (entityType === "BANK") {
      if (n.includes("district") || n.includes("dccb")) {
        const d = types.find((t) => t.key === "DCCB");
        if (d) return d.id;
      }
      const ucb = types.find((t) => t.key === "UCB");
      if (ucb) return ucb.id;
    }
    if (entityType === "CREDIT_SOCIETY") {
      if (n.includes("multistate") || n.includes("multi-state") || n.includes("multi state")) {
        const m = types.find((t) => t.key === "MULTI_STATE_CREDIT");
        if (m) return m.id;
      }
      if (n.includes("salary") || n.includes("employee") || n.includes("karmachari")) {
        const e = types.find((t) => t.key === "EMPLOYEE_CREDIT" || t.key === "SALARY_EARNERS");
        if (e) return e.id;
      }
      if (n.includes("patsanstha") || n.includes("pathsanstha")) {
        const p = types.find((t) => t.key === "URBAN_PATSANSTHA");
        if (p) return p.id;
      }
      const u = types.find((t) => t.key === "URBAN_CREDIT");
      if (u) return u.id;
    }
    const fallback = types.find((t) => t.key === "OTHER_CREDIT" || t.key === "OTHER_COOP") || types[0];
    return fallback.id;
  }

  // Deduplicate against existing institutions
  const rawNames = body.places.map((p) => p.displayName?.text?.trim() || "Unnamed Institution");
  const keys = rawNames.map((name) => dedupeKey(name));

  const existingLeads = await db
    .select({
      id: t.institutions.id,
      leadCode: t.institutions.leadCode,
      legalName: t.institutions.legalName,
      dedupeKey: t.institutions.dedupeKey
    })
    .from(t.institutions)
    .where(and(isNull(t.institutions.deletedAt), inArray(t.institutions.dedupeKey, keys)));

  const existingMap = new Map(existingLeads.map((e) => [e.dedupeKey, e]));

  const results: Array<{
    placeId?: string;
    id: string;
    leadCode: string;
    legalName: string;
    status: "created" | "already_exists";
  }> = [];

  const freshToInsert: Array<{
    place: z.infer<typeof placeSchema>;
    legalName: string;
    dedupeKey: string;
    typeId: string;
    districtId: string;
    districtCode: string;
    talukaId: string | null;
    city: string | null;
    pinCode: string | null;
    mapsUrl: string | null;
  }> = [];

  const seenKeysInBatch = new Set<string>();

  for (const place of body.places) {
    const legalName = place.displayName?.text?.trim() || "Unnamed Institution";
    const key = dedupeKey(legalName);

    if (existingMap.has(key)) {
      const existing = existingMap.get(key)!;
      results.push({
        placeId: place.id,
        id: existing.id,
        leadCode: existing.leadCode,
        legalName: existing.legalName,
        status: "already_exists"
      });
      continue;
    }

    if (seenKeysInBatch.has(key)) {
      continue;
    }
    seenKeysInBatch.add(key);

    const pin = place.pinCode || body.targetPin || "";
    const pinObj = findPin(pin);

    // Resolve State, District, and City from Place addressComponents or location
    let stateName = body.state && body.state !== "All India" ? body.state : "";
    let districtName = "";
    let cityName = body.city || "";

    if (Array.isArray(place.addressComponents)) {
      const stateComp = place.addressComponents.find((c: any) =>
        (c.types || []).includes("administrative_area_level_1")
      );
      if (stateComp?.longText) stateName = stateComp.longText;

      const distComp = place.addressComponents.find((c: any) =>
        (c.types || []).includes("administrative_area_level_2")
      );
      if (distComp?.longText) districtName = distComp.longText;

      const locComp = place.addressComponents.find((c: any) =>
        (c.types || []).includes("locality")
      );
      if (locComp?.longText) cityName = locComp.longText;
    }

    if (pinObj) {
      if (!stateName) stateName = "Maharashtra";
      if (!districtName) districtName = pinObj.district;
      if (!cityName) cityName = pinObj.city;
    } else {
      const indiaLoc = (pin && findIndiaLocation(pin)) || (cityName ? findIndiaLocation(cityName) : undefined);
      if (indiaLoc) {
        if (!stateName) stateName = indiaLoc.state;
        if (!districtName) districtName = indiaLoc.district;
        if (!cityName) cityName = indiaLoc.city;
      }
    }

    if (!stateName && pin) {
      const inferred = inferStateFromPin(pin);
      if (inferred) stateName = inferred;
    }

    // Safe fallbacks
    if (!stateName) stateName = "Maharashtra";
    if (!districtName) districtName = cityName || "Pune";
    if (!cityName) cityName = districtName || "Pune";

    districtName = districtName.replace(/\s+(District|Division|Urban|Rural)$/i, "").trim() || districtName;

    // Resolve or Auto-Create District in DB
    let district = districts.find(
      (d) =>
        d.name.toLowerCase() === districtName.toLowerCase() &&
        d.state.toLowerCase() === stateName.toLowerCase()
    );

    if (!district) {
      district = districts.find((d) => d.name.toLowerCase() === districtName.toLowerCase());
    }

    if (!district) {
      const cleanLetters = districtName.toUpperCase().replace(/[^A-Z]/g, "") + "IND";
      const baseCode = cleanLetters.slice(0, 3);
      let candidateCode = baseCode;
      let counter = 1;
      const existingCodes = new Set(districts.map((d) => d.code.toUpperCase()));
      while (existingCodes.has(candidateCode)) {
        candidateCode = (baseCode.slice(0, 2) + String(counter++)).slice(0, 3);
      }

      try {
        const [newDist] = await db
          .insert(t.districts)
          .values({
            name: districtName,
            state: stateName,
            code: candidateCode,
            active: true,
            launched: true,
          })
          .onConflictDoNothing()
          .returning();

        if (newDist) {
          district = newDist;
          districts.push(newDist);
        } else {
          const [existing] = await db
            .select()
            .from(t.districts)
            .where(and(eq(t.districts.name, districtName), eq(t.districts.state, stateName)));
          district = existing || districts[0];
        }
      } catch {
        district = districts[0];
      }
    }

    // Resolve Taluka if in Pune/Maharashtra or matching
    let talukaId: string | null = null;
    if (district && district.id) {
      if (pinObj) {
        const tMatch = talukas.find(
          (t) =>
            t.districtId === district.id &&
            (t.name.toLowerCase() === pinObj.region.toLowerCase() ||
              pinObj.area.toLowerCase().includes(t.name.toLowerCase()))
        );
        if (tMatch) talukaId = tMatch.id;
      }
      if (!talukaId && place.formattedAddress) {
        const addrLower = place.formattedAddress.toLowerCase();
        const tMatch = talukas.find(
          (t) => t.districtId === district.id && addrLower.includes(t.name.toLowerCase())
        );
        if (tMatch) talukaId = tMatch.id;
      }
    }

    const typeId = resolveTypeId(place.entityType, legalName);
    const mapsUrl =
      place.googleMapsUri ||
      (place.location
        ? `https://www.google.com/maps?q=${place.location.latitude},${place.location.longitude}`
        : null);

    freshToInsert.push({
      place,
      legalName,
      dedupeKey: key,
      typeId,
      districtId: district.id,
      districtCode: district.code,
      talukaId,
      city: cityName,
      pinCode: /^\d{6}$/.test(pin) ? pin : null,
      mapsUrl
    });
  }

  if (freshToInsert.length > 0) {
    const { rows: seq } = await db.execute<{ n: string }>(
      sql`select nextval('lead_code_seq') as n from generate_series(1, ${freshToInsert.length})`
    );

    const values = freshToInsert.map((item, idx) => ({
      legalName: item.legalName,
      leadCode: `FP-${item.districtCode}-${String(seq[idx].n).padStart(5, "0")}`,
      dedupeKey: item.dedupeKey,
      typeId: item.typeId,
      districtId: item.districtId,
      talukaId: item.talukaId,
      city: item.city,
      pinCode: item.pinCode,
      address: item.place.formattedAddress || null,
      landline: item.place.nationalPhoneNumber || null,
      website: item.place.websiteUri || null,
      mapsUrl: item.mapsUrl,
      ownerId: ctx.user.id,
      researchedById: ctx.user.id,
      verification: "UNVERIFIED" as const,
      dataConfidence: "LOW" as const
    }));

    const insertedRows = await db.insert(t.institutions).values(values).returning({
      id: t.institutions.id,
      leadCode: t.institutions.leadCode,
      legalName: t.institutions.legalName
    });

    // Provenance source records
    const accessedAt = new Date();
    await db.insert(t.sources).values(
      insertedRows.map((row, i) => ({
        institutionId: row.id,
        name: `Google Places — Society Finder (PIN ${freshToInsert[i].pinCode || body.targetPin || "Search"})`,
        url: freshToInsert[i].mapsUrl,
        accessedAt,
        evidence: `Discovered and added via Society Finder on ${accessedAt.toLocaleDateString("en-IN")}`,
        fieldKeys: ["legalName", "address", "pinCode", "landline", "website"],
        classification: "PUBLICLY_REPORTED" as const,
        addedById: ctx.user.id
      }))
    );

    const insertedIds = insertedRows.map((r) => r.id);
    await rescore(insertedIds);

    for (let i = 0; i < insertedRows.length; i++) {
      const ins = insertedRows[i];
      const orig = freshToInsert[i];
      results.push({
        placeId: orig.place.id,
        id: ins.id,
        leadCode: ins.leadCode,
        legalName: ins.legalName,
        status: "created"
      });
      await audit(ctx, "create", "institution", ins.id, null, {
        legalName: ins.legalName,
        leadCode: ins.leadCode,
        source: "society-finder"
      });
    }
  }

  const createdCount = results.filter((r) => r.status === "created").length;
  const skippedCount = results.filter((r) => r.status === "already_exists").length;

  return {
    ok: true,
    createdCount,
    skippedCount,
    results
  };
});
