import { inArray, sql } from "drizzle-orm";
import nodemailer from "nodemailer";
import { db, t } from "@/db";
import { setting } from "./settings";

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
function mailer() {
  if (!process.env.SMTP_HOST) return null;
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport;
}

/** In-app notification, plus email when enabled. Email failures are recorded (tech dashboard shows them). */
export async function notify(userIds: string[], n: { type: string; title: string; body?: string; link?: string }) {
  if (!userIds.length) return;
  await db.insert(t.notifications).values(userIds.map((userId) => ({ userId, ...n })));
  if (!(await setting<boolean>("notify.emailEnabled"))) return;
  const m = mailer();
  const users = await db.select({ id: t.users.id, email: t.users.email }).from(t.users).where(inArray(t.users.id, userIds));
  for (const u of users) {
    try {
      if (!m) throw new Error("SMTP not configured");
      await m.sendMail({ from: process.env.SMTP_FROM ?? "Fivopay CRM <no-reply@fivopay.com>", to: u.email, subject: n.title,
        text: `${n.body ?? ""}\n\n${n.link ? (process.env.APP_URL ?? "") + n.link : ""}` });
      await db.insert(t.notifications).values({ userId: u.id, ...n, channel: "EMAIL", delivery: "DELIVERED", readAt: new Date() });
    } catch (e: any) {
      await db.insert(t.notifications).values({ userId: u.id, ...n, channel: "EMAIL", delivery: "FAILED", error: String(e?.message ?? e).slice(0, 500), readAt: new Date() });
    }
  }
}

export async function superAdminIds() {
  const { rows } = await db.execute<{ id: string }>(sql`select u.id from users u join roles r on r.id = u.role_id where r.key = 'SUPER_ADMIN' and u.active`);
  return rows.map((r) => r.id);
}
