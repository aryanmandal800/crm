import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const bdmPermissions = [
  "lead.view.team",
  "lead.create",
  "lead.edit",
  "lead.assign",
  "research.edit",
  "contact.edit",
  "activity.create",
  "deal.view",
  "deal.create",
  "deal.edit",
  "pricing.view",
  "quote.create",
  "quote.send",
  "competitor.view",
  "onboarding.view",
  "tasks.manage",
  "reports.view.team",
  "performance.view.team",
  "performance.view.own",
  "cr.create",
];

async function updatePriya() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Upsert BDM role
    const roleRes = await client.query(
      `
      INSERT INTO roles (key, name, description, permissions, is_system)
      VALUES (
        'BDM',
        'Business Development Manager (BDM)',
        'Institutional business development, pipeline lead qualification, discovery meetings, product demos, pricing proposals & deals.',
        $1,
        true
      )
      ON CONFLICT (key) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        permissions = EXCLUDED.permissions
      RETURNING id, key, name;
    `,
      [bdmPermissions]
    );

    const bdmRole = roleRes.rows[0];
    console.log("BDM Role created/found:", bdmRole);

    // 2. Update Priya's role and name
    const updateRes = await client.query(
      `
      UPDATE users
      SET name = 'Priya (BDM)',
          role_id = $1
      WHERE email = 'priya@fivopay.com'
      RETURNING id, name, email, role_id;
    `,
      [bdmRole.id]
    );

    console.log("Updated Priya user record:", updateRes.rows[0]);

    await client.query("COMMIT");
    console.log("Successfully updated Priya's role to BDM!");

    // Verification query
    const verify = await client.query(`
      SELECT u.id, u.name, u.email, r.key as role_key, r.name as role_name
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.email = 'priya@fivopay.com'
    `);
    console.table(verify.rows);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Error updating Priya:", e);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

updatePriya().catch((err) => {
  console.error(err);
  process.exit(1);
});
