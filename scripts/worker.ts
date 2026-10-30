/**
 * Background worker — run as a separate process (PM2 / systemd / docker service).
 * Polls the jobs table and schedules recurring jobs (Asia/Kolkata wall clock of the server).
 */
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { db, pool, t } from "../src/db";
import { runBackup } from "../src/lib/backup";
import { rescore } from "../src/lib/scoring";
import { notify, superAdminIds } from "../src/lib/notify";
import { allSettings } from "../src/lib/settings";

const SCHEDULE: { type: string; hour: number; weekday?: number }[] = [
  { type: "BACKUP", hour: 2 }, { type: "RESCORE", hour: 3 }, { type: "EXPIRE_QUOTES", hour: 4 },
  { type: "FOLLOWUP_REMINDERS", hour: 8 }, { type: "VERIFICATION_DUE", hour: 9, weekday: 1 }, { type: "DAILY_SUMMARY", hour: 19 },
];
const MAX_ATTEMPTS = 3;

async function scheduleRecurring() {
  const now = new Date(); const day = now.toISOString().slice(0, 10);
  for (const s of SCHEDULE) {
    if (now.getHours() < s.hour || (s.weekday != null && now.getDay() !== s.weekday)) continue;
    const slot = `${s.type}:${day}`;
    const { rows } = await db.execute(sql`select 1 from jobs where payload->>'slot' = ${slot} limit 1`);
    if (!rows.length) await db.insert(t.jobs).values({ type: s.type, payload: { slot, trigger: "SCHEDULED" } });
  }
}

async function handle(job: typeof t.jobs.$inferSelect): Promise<unknown> {
  const s = await allSettings();
  switch (job.type) {
    case "BACKUP": return runBackup((job.payload as any).trigger ?? "SCHEDULED");
    case "RESCORE": return { rescored: await rescore((job.payload as any).ids) };
    case "EXPIRE_QUOTES": {
      const r = await db.update(t.quotes).set({ status: "EXPIRED" }).where(and(inArray(t.quotes.status, ["DRAFT", "APPROVED", "SENT", "PENDING_APPROVAL"]), lte(t.quotes.validUntil, new Date()))).returning({ id: t.quotes.id });
      return { expired: r.length };
    }
    case "FOLLOWUP_REMINDERS": {
      if (!s.get("notify.followupReminders")) return { skipped: true };
      const { rows } = await db.execute<{ owner_id: string; n: string; overdue: string }>(sql`
        select d.owner_id, count(*) as n, count(*) filter (where d.follow_up_date < date_trunc('day', now())) as overdue
        from deals d join pipeline_stages s on s.id = d.stage_id where s.is_open and d.follow_up_date < date_trunc('day', now()) + interval '1 day' group by d.owner_id`);
      for (const r of rows) await notify([r.owner_id], { type: "FOLLOWUP", title: `${r.n} follow-up(s) due today${Number(r.overdue) ? ` (${r.overdue} overdue)` : ""}`, link: "/my-day" });
      return { notified: rows.length };
    }
    case "VERIFICATION_DUE": {
      const { rows } = await db.execute<{ n: string }>(sql`select count(*) as n from sources where next_verification_at <= now() and institution_id is not null`);
      const n = Number(rows[0].n); if (!n) return { due: 0 };
      const { rows: users } = await db.execute<{ id: string }>(sql`select u.id from users u join roles r on r.id = u.role_id where u.active and 'research.edit' = any(r.permissions) and r.key <> 'SUPER_ADMIN'`);
      await notify(users.map((u) => u.id), { type: "VERIFICATION", title: `${n} research source(s) due for re-verification`, link: "/sources" });
      return { due: n };
    }
    case "DAILY_SUMMARY": {
      if (!s.get("notify.dailySummary")) return { skipped: true };
      const { rows } = await db.execute<any>(sql`
        select (select count(*) from activities where status = 'DONE' and occurred_at >= date_trunc('day', now())) as acts,
          (select count(*) from activities where decision_maker_reached and occurred_at >= date_trunc('day', now())) as dms,
          (select count(*) from activities where type_key = 'DEMO' and status = 'DONE' and occurred_at >= date_trunc('day', now())) as demos,
          (select count(*) from deals where won_at >= date_trunc('day', now())) as won,
          (select count(*) from deals d join pipeline_stages s on s.id = d.stage_id where s.is_open and d.follow_up_date < date_trunc('day', now())) as overdue`);
      const r = rows[0];
      await notify(await superAdminIds(), { type: "SUMMARY", title: `Today: ${r.acts} activities, ${r.dms} DMs reached, ${r.demos} demos, ${r.won} won`, body: `${r.overdue} follow-ups overdue.`, link: "/command-centre" });
      return r;
    }
    default: throw new Error(`Unknown job type ${job.type}`);
  }
}

async function tick() {
  await scheduleRecurring();
  // claim one job at a time (SKIP LOCKED allows several workers)
  for (;;) {
    const { rows } = await db.execute<{ id: string }>(sql`
      update jobs set status = 'RUNNING', started_at = now(), attempts = attempts + 1
      where id = (select id from jobs where status = 'QUEUED' and run_at <= now() order by run_at limit 1 for update skip locked) returning id`);
    if (!rows.length) return;
    const [job] = await db.select().from(t.jobs).where(eq(t.jobs.id, rows[0].id));
    try {
      const result = await handle(job);
      await db.update(t.jobs).set({ status: "DONE", finishedAt: new Date(), result: (result ?? {}) as any }).where(eq(t.jobs.id, job.id));
      console.log(new Date().toISOString(), "done", job.type);
    } catch (e: any) {
      const retry = job.attempts < MAX_ATTEMPTS;
      await db.update(t.jobs).set({ status: retry ? "QUEUED" : "FAILED", lastError: String(e?.message ?? e).slice(0, 2000), finishedAt: new Date(), runAt: new Date(Date.now() + 5 * 60e3 * job.attempts) }).where(eq(t.jobs.id, job.id));
      console.error(new Date().toISOString(), "failed", job.type, e?.message);
    }
  }
}

const once = process.argv.includes("--once");
(async () => {
  console.log("Fivopay CRM worker started", once ? "(single run)" : "");
  do {
    try { await tick(); } catch (e) { console.error("tick error", e); }
    if (!once) await new Promise((r) => setTimeout(r, Number(process.env.WORKER_INTERVAL_MS ?? 30000)));
  } while (!once);
  await pool.end();
})();
