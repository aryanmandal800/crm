import { db, t } from "@/db";

import { SETTING_DEFAULTS } from "./settings-defaults";
export { SETTING_DEFAULTS };

let cache: { at: number; map: Map<string, unknown> } | null = null;

export async function allSettings(): Promise<Map<string, unknown>> {
  if (cache && Date.now() - cache.at < 15_000) return cache.map;
  const rows = await db.select().from(t.settings);
  const map = new Map<string, unknown>(Object.entries(SETTING_DEFAULTS).map(([k, d]) => [k, d.value]));
  rows.forEach((r) => map.set(r.key, r.value));
  cache = { at: Date.now(), map };
  return map;
}
export function invalidateSettings() { cache = null; }
export async function setting<T = any>(key: string): Promise<T> { return (await allSettings()).get(key) as T; }
