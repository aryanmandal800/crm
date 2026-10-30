import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("set local app.allow_locked_edit = 'on'");
    const ids = (await c.query("select id from institutions where 'demo' = any(tags)")).rows.map((r) => r.id);
    if (ids.length) {
      for (const q of ["delete from onboardings where institution_id = any($1)", "delete from quotes where institution_id = any($1)", "delete from tasks where institution_id = any($1)",
        "delete from activities where institution_id = any($1)", "update deals set financials_locked = false where institution_id = any($1)", "delete from deals where institution_id = any($1)", "delete from institutions where id = any($1)"])
        await c.query(q, [ids]);
    }
    await c.query("commit");
    console.log(`Removed ${ids.length} demo institutions and their records.`);
  } catch (e) { await c.query("rollback"); throw e; } finally { c.release(); await pool.end(); }
})();
