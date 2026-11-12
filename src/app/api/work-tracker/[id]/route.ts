import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable } from "@/lib/access";
import { forbidden, notFound } from "@/lib/errors";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

function getDepartmentScope(ctx: any): { isCeo: boolean; enforcedDept: "BDM" | "TECH" | null } {
  const isCeo = Boolean(ctx.user?.isFounder || ctx.role?.key === "SUPER_ADMIN" || ctx.can?.("dashboard.founder"));
  if (isCeo) return { isCeo: true, enforcedDept: null };
  if (ctx.role?.key === "TECH_ADMIN" || String(ctx.role?.key).includes("TECH")) {
    return { isCeo: false, enforcedDept: "TECH" };
  }
  return { isCeo: false, enforcedDept: "BDM" };
}

export const PATCH = api<{ id: string }>(null, async (ctx, _req, { id }) => {
  assertWritable(ctx);
  const { isCeo, enforcedDept } = getDepartmentScope(ctx);

  const [existing] = await db.select().from(t.tasks).where(eq(t.tasks.id, id));
  if (!existing) throw notFound("Task not found");

  // Strictly prevent BDM from editing Tech and Tech from editing BDM
  if (enforcedDept && existing.department !== enforcedDept) {
    throw forbidden("You cannot modify another department's work item");
  }

  const body = await ctx.json(
    z.object({
      completed: z.boolean().optional(),
      status: z.enum(["OPEN", "IN_PROGRESS", "DONE", "BLOCKED", "CANCELLED"]).optional(),
      title: z.string().trim().min(2).max(300).optional(),
      description: z.string().max(4000).nullable().optional(),
      department: z.enum(["BDM", "TECH", "GENERAL"]).optional(),
      category: z.string().max(100).nullable().optional(),
      scheduledDate: z.string().regex(dateRegex).optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
      estimatedMinutes: z.number().int().min(0).max(1440).nullable().optional(),
      timeSpentMinutes: z.number().int().min(0).max(1440).nullable().optional(),
      note: z.string().max(1000).optional(),
    })
  );

  const now = new Date();
  let newStatus = body.status;
  let completedAt = existing.completedAt;
  let startedAt = existing.startedAt;

  // Handle boolean completed toggle (e.g. from checkbox)
  if (body.completed !== undefined) {
    if (body.completed) {
      newStatus = "DONE";
      completedAt = now;
    } else {
      newStatus = "OPEN";
      completedAt = null;
    }
  } else if (body.status !== undefined) {
    if (body.status === "DONE" && existing.status !== "DONE") {
      completedAt = now;
    } else if (body.status !== "DONE") {
      completedAt = null;
    }
    if (body.status === "IN_PROGRESS" && !existing.startedAt) {
      startedAt = now;
    }
  }

  const updates: Partial<typeof t.tasks.$inferInsert> = {
    updatedAt: now,
  } as any;

  if (newStatus !== undefined) updates.status = newStatus;
  if (completedAt !== undefined) updates.completedAt = completedAt;
  if (startedAt !== undefined) updates.startedAt = startedAt;
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.department !== undefined && (isCeo || body.department === enforcedDept)) {
    updates.department = body.department;
  }
  if (body.category !== undefined) updates.category = body.category;
  if (body.scheduledDate !== undefined) updates.scheduledDate = body.scheduledDate;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.estimatedMinutes !== undefined) updates.estimatedMinutes = body.estimatedMinutes;
  if (body.timeSpentMinutes !== undefined) updates.timeSpentMinutes = body.timeSpentMinutes;

  const [updated] = await db
    .update(t.tasks)
    .set(updates)
    .where(eq(t.tasks.id, id))
    .returning();

  // Log activity with timestamp
  const isStatusChange = newStatus && newStatus !== existing.status;
  const isCheckbox = body.completed !== undefined;
  const action = isCheckbox
    ? body.completed
      ? "CHECKED"
      : "UNCHECKED"
    : isStatusChange
    ? "STATUS_CHANGE"
    : "UPDATED";

  const note =
    body.note ||
    (isCheckbox
      ? body.completed
        ? "Marked task as completed via checkbox"
        : "Re-opened task via checkbox"
      : isStatusChange
      ? `Changed status from ${existing.status} to ${newStatus}`
      : "Updated task details");

  await db.insert(t.taskActivityLogs).values({
    taskId: id,
    userId: ctx.user.id,
    action,
    fromStatus: existing.status,
    toStatus: newStatus ?? existing.status,
    note,
    createdAt: now,
  });

  return { id, task: updated };
});

export const DELETE = api<{ id: string }>(null, async (ctx, _req, { id }) => {
  assertWritable(ctx);
  const { enforcedDept } = getDepartmentScope(ctx);

  const [existing] = await db.select().from(t.tasks).where(eq(t.tasks.id, id));
  if (!existing) throw notFound("Task not found");

  if (enforcedDept && existing.department !== enforcedDept) {
    throw forbidden("You cannot delete another department's work item");
  }

  if (
    existing.createdById !== ctx.user.id &&
    existing.assigneeId !== ctx.user.id &&
    !ctx.can("tasks.manage") &&
    !ctx.can("dashboard.founder")
  ) {
    throw forbidden("You cannot delete this task");
  }

  await db.delete(t.tasks).where(eq(t.tasks.id, id));
  return { ok: true, id };
});
