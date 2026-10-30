import { statfs } from "fs/promises";
import path from "path";
import { desc, eq, gte, sql } from "drizzle-orm";
import { db, pool, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { allSettings } from "@/lib/settings";
import { dtt } from "@/lib/format";
import { Badge, Card, PageHeader, Stat, Table } from "@/components/ui";
import { ActionButton } from "@/components/client/ActionButton";
import pkg from "../../../../package.json";
export const dynamic = "force-dynamic";

const mb = (b: number) => (b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${(b / 1e6).toFixed(1)} MB`);

export default async function Tech() {
  const ctx = await requirePage("tech.dashboard");
  const s = await allSettings(); const day = new Date(Date.now() - 864e5);
  const t0 = Date.now(); let dbOk = true; try { await pool.query("select 1"); } catch { dbOk = false; } const dbMs = Date.now() - t0;
  const [[dbInfo], counts, migrations, backups, failedJobs, queued, workerBeat, errors24, errors, mailFails, disk] = await Promise.all([
    db.execute<{ size: string; conns: string; version: string }>(sql`select pg_database_size(current_database())::text as size, (select count(*) from pg_stat_activity where datname = current_database())::text as conns, version() as version`).then((r) => r.rows),
    db.execute<{ tbl: string; n: string }>(sql`select relname as tbl, n_live_tup::text as n from pg_stat_user_tables order by n_live_tup desc limit 12`).then((r) => r.rows),
    db.execute<{ hash: string; created_at: string }>(sql`select hash, created_at::text from drizzle.__drizzle_migrations order by id`).then((r) => r.rows).catch(() => []),
    db.select().from(t.backups).orderBy(desc(t.backups.startedAt)).limit(8),
    db.select().from(t.jobs).where(eq(t.jobs.status, "FAILED")).orderBy(desc(t.jobs.createdAt)).limit(20),
    db.select({ n: sql<number>`count(*)::int` }).from(t.jobs).where(eq(t.jobs.status, "QUEUED")),
    db.select({ at: sql<Date | null>`max(${t.jobs.finishedAt})` }).from(t.jobs),
    db.select({ n: sql<number>`count(*)::int` }).from(t.errorLogs).where(gte(t.errorLogs.at, day)),
    db.select().from(t.errorLogs).orderBy(desc(t.errorLogs.id)).limit(25),
    db.select({ n: sql<number>`count(*)::int` }).from(t.notifications).where(sql`${t.notifications.channel} = 'EMAIL' and ${t.notifications.delivery} = 'FAILED' and ${t.notifications.createdAt} >= ${day.toISOString()}`),
    statfs(path.resolve(String(s.get("backup.dir") ?? "./backups"))).catch(() => statfs(process.cwd())).catch(() => null),
  ]);
  const lastOk = backups.find((b) => b.status === "SUCCESS");
  const backupAgeH = lastOk ? (Date.now() - lastOk.startedAt.getTime()) / 3600e3 : null;
  const mem = process.memoryUsage();
  const diskFree = disk ? disk.bavail * disk.bsize : 0, diskTotal = disk ? disk.blocks * disk.bsize : 0;
  return (<>
    <PageHeader title="Technical administration" sub={`v${pkg.version} · Node ${process.version} · ${process.env.NODE_ENV}`} actions={<>
      <ActionButton url="/api/jobs" body={{ type: "BACKUP" }} label="Run backup now" className="btn-primary" />
      <ActionButton url="/api/jobs" body={{ type: "RESCORE" }} label="Re-score all leads" />
    </>} />
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Stat label="App uptime" value={`${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`} sub={`heap ${mb(mem.heapUsed)} / rss ${mb(mem.rss)}`} />
      <Stat label="Database" value={dbOk ? "Healthy" : "DOWN"} tone={dbOk ? "good" : "bad"} sub={`${dbMs} ms · ${dbInfo?.conns} conns · ${mb(Number(dbInfo?.size ?? 0))}`} />
      <Stat label="Disk free" value={disk ? mb(diskFree) : "n/a"} sub={disk ? `of ${mb(diskTotal)} (${Math.round((diskFree / diskTotal) * 100)}%)` : undefined} tone={disk && diskFree / diskTotal < 0.1 ? "bad" : undefined} />
      <Stat label="Last good backup" value={backupAgeH == null ? "Never" : `${backupAgeH.toFixed(1)}h ago`} tone={backupAgeH == null || backupAgeH > 26 ? "bad" : "good"} />
      <Stat label="Failed jobs" value={failedJobs.length} tone={failedJobs.length ? "bad" : undefined} sub={`${queued[0].n} queued · worker last ran ${workerBeat[0].at ? dtt(workerBeat[0].at) : "never"}`} />
      <Stat label="API errors (24h)" value={errors24[0].n} tone={errors24[0].n ? "warm" : undefined} sub={`email failures: ${mailFails[0].n}`} />
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Integrations & configuration">
        <dl className="space-y-1 text-sm">
          {[["AI insights engine", `${s.get("ai.provider")} · model ${s.get("ai.model")} · API key ${process.env.ANTHROPIC_API_KEY ? "present" : "not set"}`],
            ["Email (SMTP)", `${s.get("notify.emailEnabled") ? "enabled" : "disabled"} · ${process.env.SMTP_HOST ? `host ${process.env.SMTP_HOST}` : "SMTP_HOST not set"}`],
            ["Session lifetime", `${process.env.SESSION_HOURS ?? 12}h · secure cookies ${process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false" ? "on" : "off"}`],
            ["Backup directory", String(s.get("backup.dir"))], ["Backup retention", `${s.get("backup.retentionDays")} days`],
            ["PostgreSQL", String(dbInfo?.version ?? "").split(",")[0]], ["Migrations applied", `${migrations.length}`]].map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-ink-500">{k}</dt><dd className="text-right">{v}</dd></div>)}
        </dl>
        <p className="mt-2 text-xs text-ink-500">Change technical settings in <a className="link" href="/admin/settings">Settings</a>. Secrets live in environment variables only.</p>
      </Card>
      <Card title="Backups"><Table head={["Started", "Status", "Size", "File"]} empty={!backups.length}>
        {backups.map((b) => <tr key={b.id}><td className="td text-xs">{dtt(b.startedAt)}</td><td className="td"><Badge v={b.status} /></td><td className="td text-xs">{b.sizeBytes ? mb(b.sizeBytes) : "—"}</td><td className="td max-w-[14rem] truncate text-xs">{b.file ?? b.error}</td></tr>)}
      </Table></Card>
      <Card title="Failed background jobs"><Table head={["Type", "Attempts", "Error", ""]} empty={!failedJobs.length}>
        {failedJobs.map((j) => <tr key={j.id}><td className="td text-xs">{j.type}</td><td className="td">{j.attempts}</td><td className="td max-w-xs text-xs text-red-700">{j.lastError}</td><td className="td"><ActionButton url={`/api/jobs/${j.id}/retry`} label="Retry" className="btn-ghost px-2 py-1 text-xs" /></td></tr>)}
      </Table></Card>
      <Card title="Table sizes"><Table head={["Table", "Rows"]}>{counts.map((c) => <tr key={c.tbl}><td className="td text-xs">{c.tbl}</td><td className="td text-xs">{Number(c.n).toLocaleString("en-IN")}</td></tr>)}</Table></Card>
    </div>
    <Card title="Recent API errors" className="mt-4"><Table head={["When", "Route", "Status", "Message"]} empty={!errors.length}>
      {errors.map((e) => <tr key={e.id}><td className="td whitespace-nowrap text-xs">{dtt(e.at)}</td><td className="td text-xs">{e.method} {e.route}</td><td className="td text-xs">{e.status}</td><td className="td max-w-xl text-xs text-red-700">{e.message}</td></tr>)}
    </Table></Card>
  </>);
}
