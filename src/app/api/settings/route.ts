import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { audit } from "@/lib/audit";
import { bad, forbidden } from "@/lib/errors";
import { invalidateSettings, SETTING_DEFAULTS } from "@/lib/settings";

/** Update one or more settings. Business settings: Super Admin (pricing also via pricing.config). Technical: settings.technical. */
export const PATCH = api(["settings.business", "settings.technical", "pricing.config"], async (ctx) => {
  const b = await ctx.json(z.record(z.string(), z.any()));
  const rows = await db.select().from(t.settings);
  for (const [key, value] of Object.entries(b)) {
    const row = rows.find((r) => r.key === key); const def = SETTING_DEFAULTS[key];
    if (!row && !def) throw bad(`Unknown setting ${key}`);
    const owner = row?.ownerRole ?? def?.ownerRole ?? "SUPER_ADMIN"; const cat = row?.category ?? def?.category;
    const ok = owner === "TECH_ADMIN" ? ctx.can("settings.technical") : ctx.can("settings.business") || (cat === "PRICING" && ctx.can("pricing.config"));
    if (!ok) throw forbidden(`Not allowed to change ${key}`);
    const old = row?.value ?? def?.value;
    if (typeof old === "number" && (typeof value !== "number" || Number.isNaN(value))) throw bad(`${key} must be a number`);
    if (typeof old === "boolean" && typeof value !== "boolean") throw bad(`${key} must be true/false`);
    if (key === "pricing.floorRate" && value > Number(b["pricing.listRate"] ?? rows.find((r) => r.key === "pricing.listRate")?.value)) throw bad("Floor rate cannot exceed list rate");
    if (row) await db.update(t.settings).set({ value, updatedById: ctx.user.id }).where(eq(t.settings.key, key));
    else await db.insert(t.settings).values({ key, value, category: def!.category, label: def!.label, description: def!.description, ownerRole: owner, updatedById: ctx.user.id });
    await audit(ctx, "update", "setting", key, old, value);
  }
  invalidateSettings();
  return { ok: true, message: "Saved" };
});
