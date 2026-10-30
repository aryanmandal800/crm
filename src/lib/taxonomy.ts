import { z } from "zod";
import { t } from "@/db";
import type { Permission } from "./permissions";

/** Configurable lists editable without code. Rows are deactivated, never deleted (history stays intact). */
const key = z.string().regex(/^[A-Z0-9_]{2,40}$/, "Key: CAPITALS_AND_UNDERSCORES");
export const TAXONOMY = {
  districts: { table: t.districts, perms: ["expansion.manage"] as Permission[], schema: z.object({ name: z.string().min(2).max(100), state: z.string().min(2).max(100), code: z.string().regex(/^[A-Z]{3}$/, "3 capital letters"), active: z.boolean().optional(), launched: z.boolean().optional() }) },
  talukas: { table: t.talukas, perms: ["taxonomy.manage", "settings.business"] as Permission[], schema: z.object({ name: z.string().min(2).max(100), districtId: z.string().uuid(), aliases: z.array(z.string()).optional(), notes: z.string().max(1000).nullable().optional(), active: z.boolean().optional() }) },
  types: { table: t.institutionTypes, perms: ["taxonomy.manage", "settings.business"] as Permission[], schema: z.object({ key, name: z.string().min(2).max(150), isPrimary: z.boolean(), sortOrder: z.number().int().optional(), active: z.boolean().optional() }) },
  activityTypes: { table: t.activityTypes, perms: ["taxonomy.manage", "settings.business"] as Permission[], schema: z.object({ key, name: z.string().min(2).max(100), countsAsCall: z.boolean().optional(), sortOrder: z.number().int().optional(), active: z.boolean().optional() }) },
  lostReasons: { table: t.lostReasons, perms: ["taxonomy.manage", "settings.business"] as Permission[], schema: z.object({ key, name: z.string().min(2).max(100), active: z.boolean().optional() }) },
  stages: { table: t.pipelineStages, perms: ["settings.business"] as Permission[], schema: z.object({ key, name: z.string().min(2).max(100), sortOrder: z.number().int(), probability: z.number().int().min(0).max(100), isOpen: z.boolean().optional(), isWon: z.boolean().optional(), isLost: z.boolean().optional(), isQualified: z.boolean().optional(), stallDays: z.number().int().min(1).max(365), active: z.boolean().optional() }) },
  scoring: { table: t.scoringParameters, perms: ["settings.business"] as Permission[], schema: z.object({ key: z.string().regex(/^[a-z0-9_]{2,40}$/, "key: lowercase_underscores"), name: z.string().min(2).max(150), maxScore: z.number().int().min(1).max(100), kind: z.enum(["BUILTIN", "MANUAL"]), guidance: z.string().max(1000).nullable().optional(), sortOrder: z.number().int().optional(), active: z.boolean().optional() }) },
  questions: { table: t.qualificationQuestions, perms: ["settings.business"] as Permission[], schema: z.object({ text: z.string().min(5).max(500), sortOrder: z.number().int().optional(), active: z.boolean().optional() }) },
  teams: { table: t.teams, perms: ["users.manage"] as Permission[], schema: z.object({ name: z.string().min(2).max(100), region: z.string().max(100).nullable().optional(), managerId: z.string().uuid().nullable().optional() }) },
} as const;
export type TaxonomyKey = keyof typeof TAXONOMY;
