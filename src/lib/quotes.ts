import { eq, sql } from "drizzle-orm";
import { db, t } from "@/db";

const STOP = new Set(["the", "co", "op", "operative", "cooperative", "co-operative", "credit", "society", "ltd", "limited", "maryadit", "sahakari", "of", "and", "demo", "sample"]);
export function clientCode(name: string) {
  const words = name.replace(/\[.*?\]/g, " ").replace(/[^A-Za-z ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase()));
  const code = words.map((w) => w[0]).join("").toUpperCase().slice(0, 6);
  return code.length >= 2 ? code : (words[0] ?? "CLIENT").toUpperCase().slice(0, 6);
}

/** Atomically allocate the next serial from settings (row-locked). Format PREFIX/CLIENT/YYYY/NNN. */
export async function allocateQuoteNumber(institutionName: string) {
  return db.transaction(async (tx) => {
    const { rows } = await tx.execute<{ value: any }>(sql`select value from settings where key = 'sales.quoteNextSerial' for update`);
    const { rows: pre } = await tx.execute<{ value: any }>(sql`select value from settings where key = 'sales.quotePrefix'`);
    const { rows: mx } = await tx.execute<{ m: number | null }>(sql`select max(serial) as m from quotes`);
    const serial = Math.max(Number(rows[0]?.value ?? 1), Number(mx[0]?.m ?? 0) + 1);
    await tx.update(t.settings).set({ value: serial + 1 }).where(eq(t.settings.key, "sales.quoteNextSerial"));
    const prefix = String(pre[0]?.value ?? "FP/CP");
    return { serial, number: `${prefix}/${clientCode(institutionName)}/${new Date().getFullYear()}/${String(serial).padStart(3, "0")}` };
  });
}
