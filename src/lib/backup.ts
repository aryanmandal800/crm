import { spawn } from "child_process";
import { mkdir, readdir, stat, unlink } from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { allSettings } from "./settings";

/** pg_dump (custom format, compressed) into backup.dir; prunes files older than retention. */
export async function runBackup(trigger = "SCHEDULED") {
  const s = await allSettings();
  const dir = path.resolve(String(s.get("backup.dir") ?? "./backups"));
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `fivopay-crm-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`);
  const [row] = await db.insert(t.backups).values({ trigger, file }).returning();
  try {
    await new Promise<void>((res, rej) => {
      const p = spawn(process.env.PG_DUMP_PATH ?? "pg_dump", ["--format=custom", "--no-owner", `--file=${file}`, process.env.DATABASE_URL!.replace(/\?host=.*$/, "")], {
        env: (() => { const e = { ...process.env }; const h = new URL(process.env.DATABASE_URL!).searchParams.get("host"); if (h) e.PGHOST = h; return e; })(),
      });
      let err = ""; p.stderr.on("data", (d) => (err += d)); p.on("error", rej); p.on("close", (c) => (c === 0 ? res() : rej(new Error(err || `pg_dump exited ${c}`))));
    });
    const size = (await stat(file)).size;
    await db.update(t.backups).set({ status: "SUCCESS", finishedAt: new Date(), sizeBytes: size }).where(eq(t.backups.id, row.id));
    const keepDays = Number(s.get("backup.retentionDays") ?? 14);
    for (const f of await readdir(dir)) {
      if (!f.startsWith("fivopay-crm-") || !f.endsWith(".dump")) continue;
      const fp = path.join(dir, f); if ((await stat(fp)).mtimeMs < Date.now() - keepDays * 864e5) await unlink(fp);
    }
    return { file, size };
  } catch (e: any) {
    await db.update(t.backups).set({ status: "FAILED", finishedAt: new Date(), error: String(e?.message ?? e).slice(0, 2000) }).where(eq(t.backups.id, row.id));
    throw e;
  }
}
