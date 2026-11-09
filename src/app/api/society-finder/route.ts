import { z } from "zod";
import { and, inArray, isNull } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { HttpError } from "@/lib/errors";
import { dedupeKey } from "@/lib/leads";
import { findPin } from "@/lib/maharashtraPins";
import { inferStateFromPin, findIndiaLocation } from "@/lib/indiaGeography";

const searchSchema = z.object({
  pin: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit Indian PIN code"),
  category: z.string().trim().default("Cooperative Credit Society"),
  pageSize: z.number().int().min(1).max(100).default(20),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  entityFilter: z.enum(["ALL", "CREDIT_ONLY", "HOUSING_ONLY", "BANK_ONLY", "SOCIETY_ONLY"]).default("ALL")
});

type EntityType = "CREDIT_SOCIETY" | "HOUSING_SOCIETY" | "BANK" | "OTHER";

function classifyInstitution(name: string): EntityType {
  const n = (name || "").toLowerCase().trim();

  // 1. Check for Housing Society (Co-op Housing Society / CHS / Gruhanirman Sanstha / Apartment Society)
  const isHousing =
    /\b(housing|hsg|chs|chsl|c\.h\.s|c\.h\.s\.l|c-h-s|gruhanirman|gruha\s*nirman|gruh\s*nirman)\b/i.test(n) ||
    n.includes("housing society") ||
    n.includes("housing soc") ||
    n.includes("hsg society") ||
    n.includes("hsg soc") ||
    n.includes("co-operative housing") ||
    n.includes("cooperative housing") ||
    n.includes("co-op housing") ||
    n.includes("co op housing") ||
    n.includes("co.op.housing") ||
    n.includes("sahakari gruhanirman") ||
    /\b(niwas|apartment|apartments|enclave|residency|villas|heights|towers?|complex)\s+(chs|society|soc)\b/i.test(n);

  // Check for explicit credit society / financial keywords
  const isExplicitCredit =
    /\b(credit|patsanstha|pathsanstha|pathpedhi|patpedhi|dhansanchay|nidhi|bachat|loan|finance|vittiya|cr\s*soc)\b/i.test(n) ||
    /\b(co-?op\s+cr\b|co-?op\s+credit)/i.test(n);

  // If identified as housing society and NOT a financial credit entity, classify as HOUSING_SOCIETY
  if (isHousing && !isExplicitCredit) {
    return "HOUSING_SOCIETY";
  }

  // 2. Check for Bank (Co-operative Banks, Commercial Banks, DCCBs, UCBs)
  const bankPatterns = [
    /\b(co-operative bank|cooperative bank|co-op bank|co op bank)\b/i,
    /\b(sahakari bank|nagari bank|nagrik bank|gramin bank)\b/i,
    /\b(district central co-operative bank|district central cooperative bank|dccb)\b/i,
    /\b(urban co-operative bank|urban cooperative bank|ucb)\b/i,
    /\b(bank ltd|bank limited|bank maryadit)\b/i,
    /\b(small finance bank|payments bank|commercial bank)\b/i,
    /\b(state bank of india|bank of maharashtra|bank of baroda|punjab national bank|canara bank|union bank|hdfc bank|icici bank|axis bank|kotak|idbi bank)\b/i
  ];

  const matchesStrictBank = bankPatterns.some((pattern) => pattern.test(n));
  const hasBankWord = /\b(bank|banking)\b/i.test(n);
  const isColonyOrPlace = /\b(nagar|colony|vihar|enclave|society|lane|road|bldg|building|complex|chowk|street)\b/i.test(n);

  if (matchesStrictBank || (hasBankWord && !isColonyOrPlace && !isExplicitCredit)) {
    return "BANK";
  }

  // 3. Other co-operatives that are not credit societies (e.g. Dairy / Sugar)
  const isOtherCoop = /\b(dudh|dairy|sakhar|karkhana|soot|textile|spinning|fishery|matsya|consumer|bhandar)\b/i.test(n);
  if (isOtherCoop && !isExplicitCredit) {
    return "OTHER";
  }

  // 4. Co-operative Credit Society / Patsanstha
  const isCreditSociety =
    isExplicitCredit ||
    /\b(credit co-operative|co-operative credit|cooperative credit|credit co-op|credit soc|multistate credit|salary earners|thrift)\b/i.test(n) ||
    /\b(patsanstha|pathsanstha|pathpedhi|patpedhi|sahakari patsanstha|nagari patsanstha)\b/i.test(n) ||
    (/\b(society|societies|co-operative|cooperative|sanstha|mandali)\b/i.test(n) && !isHousing);

  if (isCreditSociety) {
    return "CREDIT_SOCIETY";
  }

  if (hasBankWord) {
    return "BANK";
  }

  return "OTHER";
}

function component(place: any, type: string) {
  const comp = (place.addressComponents || []).find((c: any) =>
    (c.types || []).includes(type)
  );
  return comp?.longText || comp?.shortText || "";
}

function getPin(place: any) {
  const value = component(place, "postal_code");
  if (value) return value;
  const match = (place.formattedAddress || "").match(/\b\d{6}\b/);
  return match ? match[0] : "";
}

function score(place: any, targetPin: string, city: string, state: string) {
  const pin = getPin(place);
  const address = (place.formattedAddress || "").toLowerCase();
  const loc = component(place, "locality").toLowerCase();
  const st = component(place, "administrative_area_level_1").toLowerCase();
  const cLower = city ? city.toLowerCase().trim() : "";
  const sLower = (state && state !== "All India") ? state.toLowerCase().trim() : "";

  if (targetPin && pin === targetPin) return 1000;
  if (targetPin && pin && targetPin.slice(0, 3) === pin.slice(0, 3)) return 600;
  if (cLower && (loc.includes(cLower) || address.includes(cLower))) return 400;
  if (sLower && (st.includes(sLower) || address.includes(sLower))) return 200;
  return 100;
}

export const POST = api(null, async (ctx) => {
  const body = await ctx.json(searchSchema);
  const key = process.env.GOOGLE_MAPS_API_KEY;

  if (!key) {
    throw new HttpError(
      500,
      "Google Maps API key is not configured. Please set GOOGLE_MAPS_API_KEY in your .env file."
    );
  }

  const category = body.category?.trim() || "Cooperative Credit Society";
  const pin = body.pin.trim();

  // Automatically resolve location details from PIN code
  const loc = findIndiaLocation(pin) || (findPin(pin) ? { ...findPin(pin)!, state: "Maharashtra" } : null);
  const inferredState = inferStateFromPin(pin);
  const city = loc?.city || body.city || "";
  const state = loc?.state || inferredState || body.state || "";

  // Build high-relevance search query for Google Places
  const locParts: string[] = [pin];
  if (city) locParts.push(city);
  if (state && state !== "All India") locParts.push(state);

  const textQuery = `${category} in ${locParts.join(" ")}, India`.replace(/\s+/g, " ").trim();
  const fieldMask = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.addressComponents",
    "places.location",
    "places.nationalPhoneNumber",
    "places.websiteUri",
    "places.googleMapsUri",
    "nextPageToken"
  ].join(",");

  const rawPlaces: any[] = [];
  let pageToken: string | undefined = undefined;
  const targetCount = body.pageSize;
  const maxPages = Math.ceil(targetCount / 20);

  for (let page = 1; page <= maxPages; page++) {
    const payload: Record<string, any> = {
      textQuery,
      pageSize: 20,
      regionCode: "IN"
    };
    if (pageToken) payload.pageToken = pageToken;

    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": fieldMask
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      if (rawPlaces.length > 0) break; // Return what we got
      throw new HttpError(
        response.status,
        data.error?.message || "Google Places API request failed"
      );
    }

    const currentPlaces = data.places || [];
    rawPlaces.push(...currentPlaces);

    pageToken = data.nextPageToken;
    if (!pageToken || rawPlaces.length >= targetCount) {
      break;
    }
  }

  const classified = rawPlaces.map((p: any) => {
    const entityType = classifyInstitution(p.displayName?.text || "");
    return {
      ...p,
      entityType,
      pinCode: getPin(p),
      matchScore: score(p, body.pin, city, state)
    };
  });

  // Sort by match score
  classified.sort((a: any, b: any) => b.matchScore - a.matchScore);

  // If entityFilter is specified on request
  const filtered =
    body.entityFilter === "CREDIT_ONLY" || body.entityFilter === "SOCIETY_ONLY"
      ? classified.filter((p) => p.entityType === "CREDIT_SOCIETY")
      : body.entityFilter === "HOUSING_ONLY"
      ? classified.filter((p) => p.entityType === "HOUSING_SOCIETY")
      : body.entityFilter === "BANK_ONLY"
      ? classified.filter((p) => p.entityType === "BANK")
      : classified;

  const resultPlaces = filtered.slice(0, targetCount);

  // Check which places already exist in CRM leads database
  const keys = resultPlaces
    .map((p: any) => dedupeKey(p.displayName?.text || ""))
    .filter(Boolean);

  let existingMap = new Map<string, { id: string; leadCode: string }>();
  if (keys.length > 0) {
    const existing = await db
      .select({
        id: t.institutions.id,
        leadCode: t.institutions.leadCode,
        dedupeKey: t.institutions.dedupeKey
      })
      .from(t.institutions)
      .where(and(isNull(t.institutions.deletedAt), inArray(t.institutions.dedupeKey, keys)));

    existingMap = new Map(existing.map((e) => [e.dedupeKey, { id: e.id, leadCode: e.leadCode }]));
  }

  const placesWithLeadStatus = resultPlaces.map((p: any) => ({
    ...p,
    existingLead: existingMap.get(dedupeKey(p.displayName?.text || "")) || null
  }));

  const creditCount = classified.filter((p) => p.entityType === "CREDIT_SOCIETY").length;
  const housingCount = classified.filter((p) => p.entityType === "HOUSING_SOCIETY").length;
  const bankCount = classified.filter((p) => p.entityType === "BANK").length;

  return {
    targetPin: body.pin,
    query: textQuery,
    total: placesWithLeadStatus.length,
    rawTotal: classified.length,
    creditCount,
    housingCount,
    bankCount,
    societyCount: creditCount, // For backwards compatibility
    exactMatches: body.pin ? placesWithLeadStatus.filter((p: any) => p.pinCode === body.pin).length : placesWithLeadStatus.length,
    places: placesWithLeadStatus
  };
});
