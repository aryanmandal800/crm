import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const g = globalThis as unknown as { __pool?: Pool };
export const pool = g.__pool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL_MAX ?? 10) });
if (process.env.NODE_ENV !== "production") g.__pool = pool;

export const db = drizzle(pool, { schema });
export type DB = typeof db;
export * as t from "./schema";
