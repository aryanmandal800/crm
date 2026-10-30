import type { FieldDef } from "@/components/client/JsonForm";
import { SETTING_DEFAULTS } from "./settings-defaults";

/** Build form fields for a settings category from current values. Objects/arrays edit as JSON. */
export function settingFields(category: string, values: Map<string, unknown>, filter?: (key: string) => boolean): { fields: FieldDef[]; initial: Record<string, any> } {
  const keys = Object.keys(SETTING_DEFAULTS).filter((k) => SETTING_DEFAULTS[k].category === category && (!filter || filter(k)));
  const fields: FieldDef[] = []; const initial: Record<string, any> = {};
  for (const k of keys) {
    const d = SETTING_DEFAULTS[k]; const v = values.get(k) ?? d.value;
    const type = typeof d.value === "number" ? "number" : typeof d.value === "boolean" ? "checkbox" : typeof d.value === "string" ? (String(d.value).length > 60 ? "textarea" : "text") : "json";
    fields.push({ name: k, label: d.label, type: type as any, help: d.description }); initial[k] = v;
  }
  return { fields, initial };
}
