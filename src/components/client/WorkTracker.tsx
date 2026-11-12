"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import clsx from "clsx";
import {
  Calendar as CalendarIcon,
  CheckSquare,
  Square,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Code2,
  FileText,
  Kanban,
  Sparkles,
  Send,
  Trash2,
  ListTodo,
  TrendingUp,
  X,
  User,
  ArrowRight,
  Check,
  Building,
  RefreshCw,
  Eye,
  History,
} from "lucide-react";

export type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  department: "BDM" | "TECH" | "GENERAL";
  category: string | null;
  scheduledDate: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "OPEN" | "IN_PROGRESS" | "DONE" | "BLOCKED" | "CANCELLED";
  estimatedMinutes: number | null;
  timeSpentMinutes: number | null;
  assigneeId: string;
  createdById: string;
  institutionId: string | null;
  dealId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  assignee?: { id: string; name: string; email: string };
  creator?: { id: string; name: string; email: string };
  institution?: { id: string; legalName: string; leadCode: string } | null;
  activityLogs?: ActivityLog[];
};

export type ActivityLog = {
  id: string;
  taskId: string;
  userId: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string };
  taskTitle?: string;
  taskDepartment?: string;
};

export type EodReport = {
  id: string;
  userId: string;
  reportDate: string;
  department: "BDM" | "TECH" | "GENERAL";
  summary: string | null;
  keyWins: string | null;
  blockers: string | null;
  planForTomorrow: string | null;
  hoursSpent: number;
  tasksCompletedCount: number;
  tasksPendingCount: number;
  completionRate: number;
  status: "DRAFT" | "SUBMITTED";
  submittedAt: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string };
};

type UserOption = {
  id: string;
  name: string;
  email: string;
  role: { key: string; name: string };
};

type InstitutionOption = {
  id: string;
  legalName: string;
};

interface WorkTrackerProps {
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: string;
    isFounder: boolean;
    isCeo: boolean;
    userDepartment: "BDM" | "TECH" | "ALL";
  };
  users: UserOption[];
  institutions: InstitutionOption[];
}

// Helpers
function formatDisplayDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function formatTime(isoStr: string | null | undefined) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateTime(isoStr: string | null | undefined) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function getWeekDays(dateStr: string): string[] {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay(); // 0 is Sunday, 1 is Monday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    days.push(cur.toISOString().slice(0, 10));
  }
  return days;
}

export function WorkTracker({ currentUser, users, institutions }: WorkTrackerProps) {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const initialDept: "ALL" | "BDM" | "TECH" = currentUser.isCeo ? "ALL" : (currentUser.userDepartment as "BDM" | "TECH");
  const [department, setDepartment] = useState<"ALL" | "BDM" | "TECH">(initialDept);
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [view, setView] = useState<"day" | "week" | "month" | "board" | "eod">("day");

  // Data states
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [dayStats, setDayStats] = useState<Record<string, any>>({});
  const [eodReports, setEodReports] = useState<EodReport[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Modals & Inline forms
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEodModalOpen, setIsEodModalOpen] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [quickTaskDept, setQuickTaskDept] = useState<"BDM" | "TECH">(
    currentUser.userDepartment === "TECH" ? "TECH" : "BDM"
  );

  // Detailed Add Task Form
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    department: (currentUser.userDepartment === "TECH" ? "TECH" : "BDM") as "BDM" | "TECH" | "GENERAL",
    category: currentUser.userDepartment === "TECH" ? "Bug Fix" : "Field Visit",
    scheduledDate: todayStr,
    priority: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
    status: "OPEN" as "OPEN" | "IN_PROGRESS" | "DONE" | "BLOCKED",
    estimatedMinutes: 30,
    assigneeId: currentUser.id,
    institutionId: "",
  });

  // EOD Form State
  const [eodForm, setEodForm] = useState({
    summary: "",
    keyWins: "",
    blockers: "",
    planForTomorrow: "",
    hoursSpent: 8,
    department: (currentUser.userDepartment === "TECH" ? "TECH" : "BDM") as "BDM" | "TECH" | "GENERAL",
  });

  // Calculate range based on view
  const { startDate, endDate } = useMemo(() => {
    if (view === "day" || view === "board" || view === "eod") {
      return { startDate: selectedDate, endDate: selectedDate };
    }
    if (view === "week") {
      const days = getWeekDays(selectedDate);
      return { startDate: days[0], endDate: days[6] };
    }
    if (view === "month") {
      const [y, m] = selectedDate.split("-").map(Number);
      const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
      const end = new Date(y, m, 0).toISOString().slice(0, 10);
      return { startDate: start, endDate: end };
    }
    return { startDate: selectedDate, endDate: selectedDate };
  }, [view, selectedDate]);

  // Fetch tasks
  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      params.set("department", department);
      if (selectedUserId && selectedUserId !== "all") {
        params.set("userId", selectedUserId);
      }
      if (view === "week" || view === "month") {
        params.set("startDate", startDate);
        params.set("endDate", endDate);
      } else {
        params.set("date", selectedDate);
      }
      params.set("view", view);

      const res = await fetch(`/api/work-tracker?${params.toString()}`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed to fetch work tracker data");
      const data = await res.json();
      setTasks(data.tasks || []);
      setDayStats(data.dayStats || {});
      setEodReports(data.eodReports || []);
      setActivityLogs(data.logs || []);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [department, selectedUserId, selectedDate, startDate, endDate, view]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter tasks for current day in day/board/eod view
  const currentDayTasks = useMemo(() => {
    return tasks.filter((t) => {
      const d = t.scheduledDate || (t.createdAt ? t.createdAt.slice(0, 10) : todayStr);
      return d === selectedDate;
    });
  }, [tasks, selectedDate, todayStr]);

  // Statistics for selected date
  const stats = useMemo(() => {
    const list = currentDayTasks;
    const total = list.length;
    const completed = list.filter((t) => t.status === "DONE").length;
    const inProgress = list.filter((t) => t.status === "IN_PROGRESS").length;
    const blocked = list.filter((t) => t.status === "BLOCKED").length;
    const pending = total - completed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    const bdmTasks = list.filter((t) => t.department === "BDM");
    const bdmDone = bdmTasks.filter((t) => t.status === "DONE").length;
    const bdmPercent = bdmTasks.length > 0 ? Math.round((bdmDone / bdmTasks.length) * 100) : 0;

    const techTasks = list.filter((t) => t.department === "TECH");
    const techDone = techTasks.filter((t) => t.status === "DONE").length;
    const techPercent = techTasks.length > 0 ? Math.round((techDone / techTasks.length) * 100) : 0;

    return {
      total,
      completed,
      pending,
      inProgress,
      blocked,
      percentage,
      bdm: { total: bdmTasks.length, done: bdmDone, percent: bdmPercent },
      tech: { total: techTasks.length, done: techDone, percent: techPercent },
    };
  }, [currentDayTasks]);

  // Checkbox toggle handler
  async function toggleTaskComplete(task: TaskItem) {
    const willComplete = task.status !== "DONE";
    const nowIso = new Date().toISOString();

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: willComplete ? "DONE" : "OPEN",
              completedAt: willComplete ? nowIso : null,
            }
          : t
      )
    );

    try {
      const res = await fetch(`/api/work-tracker/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: willComplete }),
      });
      if (!res.ok) {
        throw new Error((await res.json()).error);
      }
      fetchData();
    } catch (e: any) {
      setErr(e.message);
      fetchData(); // Rollback
    }
  }

  // Status change handler (Kanban move / quick action)
  async function changeTaskStatus(taskId: string, newStatus: TaskItem["status"], note?: string) {
    try {
      const res = await fetch(`/api/work-tracker/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, note }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      fetchData();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  // Delete task
  async function deleteTask(taskId: string) {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      const res = await fetch(`/api/work-tracker/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (e: any) {
      alert(e.message);
    }
  }

  // Quick task add
  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;

    try {
      const res = await fetch("/api/work-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: quickTaskTitle.trim(),
          department: currentUser.isCeo ? quickTaskDept : (currentUser.userDepartment as "BDM" | "TECH"),
          scheduledDate: selectedDate,
          priority: "MEDIUM",
          status: "OPEN",
          assigneeId: selectedUserId !== "all" ? selectedUserId : currentUser.id,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setQuickTaskTitle("");
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  }

  // Full task modal submit
  async function handleDetailedTaskSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!taskForm.title.trim()) return;

    try {
      const res = await fetch("/api/work-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...taskForm,
          department: currentUser.isCeo ? taskForm.department : (currentUser.userDepartment as "BDM" | "TECH"),
          institutionId: taskForm.institutionId || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setIsAddModalOpen(false);
      setTaskForm({
        title: "",
        description: "",
        department: (currentUser.userDepartment === "TECH" ? "TECH" : "BDM") as "BDM" | "TECH" | "GENERAL",
        category: currentUser.userDepartment === "TECH" ? "Bug Fix" : "Field Visit",
        scheduledDate: selectedDate,
        priority: "MEDIUM",
        status: "OPEN",
        estimatedMinutes: 30,
        assigneeId: currentUser.id,
        institutionId: "",
      });
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  }

  // Submit EOD
  async function handleEodSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eodForm.summary.trim()) {
      alert("Please enter a summary of today's work");
      return;
    }

    try {
      const res = await fetch("/api/work-tracker/eod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportDate: selectedDate,
          department: currentUser.isCeo ? eodForm.department : (currentUser.userDepartment as "BDM" | "TECH"),
          summary: eodForm.summary,
          keyWins: eodForm.keyWins || null,
          blockers: eodForm.blockers || null,
          planForTomorrow: eodForm.planForTomorrow || null,
          hoursSpent: Number(eodForm.hoursSpent) || 8,
          status: "SUBMITTED",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setIsEodModalOpen(false);
      fetchData();
      alert("EOD Report submitted successfully!");
    } catch (e: any) {
      alert(e.message);
    }
  }

  // Current day's existing EOD
  const currentDayEod = useMemo(() => {
    return eodReports.find(
      (r) =>
        r.reportDate === selectedDate &&
        (selectedUserId === "all" ? r.userId === currentUser.id : r.userId === selectedUserId)
    );
  }, [eodReports, selectedDate, selectedUserId, currentUser.id]);

  // Open EOD modal with prefill
  function openEodModal() {
    if (currentDayEod) {
      setEodForm({
        summary: currentDayEod.summary || "",
        keyWins: currentDayEod.keyWins || "",
        blockers: currentDayEod.blockers || "",
        planForTomorrow: currentDayEod.planForTomorrow || "",
        hoursSpent: currentDayEod.hoursSpent || 8,
        department: currentDayEod.department || "BDM",
      });
    } else {
      // Auto-summarize
      const doneTitles = currentDayTasks
        .filter((t) => t.status === "DONE")
        .map((t) => `• ${t.title}`)
        .join("\n");
      const pendingTitles = currentDayTasks
        .filter((t) => t.status !== "DONE")
        .map((t) => `• [Pending] ${t.title}`)
        .join("\n");

      setEodForm({
        summary: doneTitles ? `Completed Tasks:\n${doneTitles}` : "Completed daily operations and client interactions.",
        keyWins: "",
        blockers: "",
        planForTomorrow: pendingTitles ? `Follow-up on pending items:\n${pendingTitles}` : "",
        hoursSpent: 8,
        department: (currentUser.userDepartment === "TECH" ? "TECH" : "BDM") as "BDM" | "TECH" | "GENERAL",
      });
    }
    setIsEodModalOpen(true);
  }

  // Date Navigation handlers
  function handlePrevDate() {
    if (view === "week") {
      setSelectedDate(addDaysToDateStr(selectedDate, -7));
    } else if (view === "month") {
      const [y, m, d] = selectedDate.split("-").map(Number);
      const prevM = new Date(y, m - 2, 1);
      setSelectedDate(prevM.toISOString().slice(0, 10));
    } else {
      setSelectedDate(addDaysToDateStr(selectedDate, -1));
    }
  }

  function handleNextDate() {
    if (view === "week") {
      setSelectedDate(addDaysToDateStr(selectedDate, 7));
    } else if (view === "month") {
      const [y, m, d] = selectedDate.split("-").map(Number);
      const nextM = new Date(y, m, 1);
      setSelectedDate(nextM.toISOString().slice(0, 10));
    } else {
      setSelectedDate(addDaysToDateStr(selectedDate, 1));
    }
  }

  const isToday = selectedDate === todayStr;

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="h1 text-ink-900">Work Tracker & EOD</h1>
            <span
              className={clsx(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                currentUser.isCeo
                  ? "bg-violet-100 text-violet-800"
                  : currentUser.userDepartment === "TECH"
                  ? "bg-sky-100 text-sky-800"
                  : "bg-brand-100 text-brand-800"
              )}
            >
              {currentUser.isCeo
                ? "👑 CEO Oversight"
                : currentUser.userDepartment === "TECH"
                ? "💻 Tech Department"
                : "💼 BDM Department"}
            </span>
          </div>
          <p className="muted mt-1">
            {currentUser.isCeo
              ? "Full executive oversight: Monitor daily to-dos, progress %, activity logs, and EOD reports for both BDM and Tech teams."
              : currentUser.userDepartment === "TECH"
              ? "Engineering & DevOps daily work tracker, bug fixes, progress %, and EOD reports. (BDM work is isolated)."
              : "Business development daily work tracker, client demos, progress %, and EOD reports. (Tech work is isolated)."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setTaskForm((prev) => ({ ...prev, scheduledDate: selectedDate }));
              setIsAddModalOpen(true);
            }}
            className="btn-primary"
          >
            <Plus size={16} />
            <span>Add Work Item</span>
          </button>

          <button onClick={openEodModal} className="btn-ghost text-brand-600 font-semibold hover:border-brand-300">
            <FileText size={16} />
            <span>{currentDayEod ? "Edit EOD Report" : "Submit EOD Report"}</span>
          </button>

          <button
            onClick={fetchData}
            className="rounded-lg border border-ink-200 bg-white p-2 text-ink-600 hover:bg-ink-50"
            title="Refresh"
          >
            <RefreshCw size={16} className={clsx(loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Top Filter and View Switcher Card */}
      <div className="card p-3 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
        {/* Department Filters - CEO sees all tabs, BDM/Tech only see their locked workspace */}
        <div className="flex flex-wrap items-center gap-1.5">
          {currentUser.isCeo ? (
            <>
              <span className="text-xs font-medium text-ink-500 mr-1 flex items-center gap-1">
                <Filter size={13} /> Dept:
              </span>
              <button
                onClick={() => setDepartment("ALL")}
                className={clsx(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  department === "ALL" ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                )}
              >
                All Work
              </button>
              <button
                onClick={() => setDepartment("BDM")}
                className={clsx(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition flex items-center gap-1.5",
                  department === "BDM"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200"
                )}
              >
                <Briefcase size={13} />
                <span>BDM (Sales)</span>
              </button>
              <button
                onClick={() => setDepartment("TECH")}
                className={clsx(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition flex items-center gap-1.5",
                  department === "TECH"
                    ? "bg-sky-600 text-white shadow-sm"
                    : "bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200"
                )}
              >
                <Code2 size={13} />
                <span>Tech & DevOps</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              {currentUser.userDepartment === "BDM" ? (
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-violet-600 text-white px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow-xs">
                    <Briefcase size={13} />
                    <span>BDM Workspace (Sales)</span>
                  </span>
                  <span className="text-[11px] text-ink-400 font-medium hidden sm:inline">
                    🔒 Tech work is hidden · Confidential to BDM team & CEO
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-sky-600 text-white px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow-xs">
                    <Code2 size={13} />
                    <span>Tech & Engineering Workspace</span>
                  </span>
                  <span className="text-[11px] text-ink-400 font-medium hidden sm:inline">
                    🔒 BDM work is hidden · Confidential to Tech team & CEO
                  </span>
                </div>
              )}
            </div>
          )}

          {/* User selector */}
          <div className="ml-2 inline-flex items-center gap-1">
            <User size={13} className="text-ink-400" />
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="rounded-lg border border-ink-200 bg-white py-1 pl-2 pr-6 text-xs font-medium text-ink-700 outline-none"
            >
              <option value="all">
                {currentUser.isCeo ? "Everyone's Work" : `${currentUser.userDepartment} Team Work`}
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role.name.split(" ")[0]})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 border-t pt-2 sm:border-t-0 sm:pt-0">
          <button
            onClick={() => setView("day")}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
              view === "day" ? "bg-brand-600 text-white shadow-sm" : "text-ink-600 hover:bg-ink-100"
            )}
            title="Day View with To-Do checkboxes"
          >
            <ListTodo size={14} />
            <span className="hidden sm:inline">Day</span>
          </button>
          <button
            onClick={() => setView("week")}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
              view === "week" ? "bg-brand-600 text-white shadow-sm" : "text-ink-600 hover:bg-ink-100"
            )}
            title="7-Day Weekly Breakdown"
          >
            <CalendarIcon size={14} />
            <span className="hidden sm:inline">Week</span>
          </button>
          <button
            onClick={() => setView("month")}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
              view === "month" ? "bg-brand-600 text-white shadow-sm" : "text-ink-600 hover:bg-ink-100"
            )}
            title="Full Month Calendar"
          >
            <CalendarIcon size={14} />
            <span className="hidden sm:inline">Month</span>
          </button>
          <button
            onClick={() => setView("board")}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
              view === "board" ? "bg-brand-600 text-white shadow-sm" : "text-ink-600 hover:bg-ink-100"
            )}
            title="Trello-style Kanban Board"
          >
            <Kanban size={14} />
            <span className="hidden sm:inline">Board</span>
          </button>
          <button
            onClick={() => setView("eod")}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
              view === "eod" ? "bg-brand-600 text-white shadow-sm" : "text-ink-600 hover:bg-ink-100"
            )}
            title="End of Day Reports"
          >
            <FileText size={14} />
            <span className="hidden sm:inline">EOD Log</span>
          </button>
        </div>
      </div>

      {/* Date Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-ink-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevDate}
            className="p-1.5 rounded-lg border border-ink-200 hover:bg-ink-100 text-ink-700"
            title="Previous"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setSelectedDate(todayStr)}
            className={clsx(
              "px-3 py-1 rounded-lg text-xs font-medium border transition",
              isToday
                ? "bg-brand-50 border-brand-200 text-brand-700 font-semibold"
                : "border-ink-200 hover:bg-ink-50 text-ink-700"
            )}
          >
            Today
          </button>
          <button
            onClick={handleNextDate}
            className="p-1.5 rounded-lg border border-ink-200 hover:bg-ink-100 text-ink-700"
            title="Next"
          >
            <ChevronRight size={18} />
          </button>

          <div className="ml-2 font-semibold text-sm sm:text-base text-ink-900">
            {view === "week"
              ? `Week of ${formatShortDate(startDate)} – ${formatShortDate(endDate)}`
              : view === "month"
              ? new Date(selectedDate).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
              : formatDisplayDate(selectedDate)}
          </div>
        </div>

        {/* Quick Jump Datepicker */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-500 font-medium">Jump to Date:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="rounded-lg border border-ink-300 px-2 py-1 text-xs text-ink-800 bg-white outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Daily Progress Gauge & Stat Cards (Visible in Day & Board views) */}
      {(view === "day" || view === "board") && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {/* Main Percentage Progress Card */}
          <div className="card col-span-2 p-4 bg-gradient-to-br from-white to-brand-50/40 border-brand-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                Daily Completion
              </span>
              <span
                className={clsx(
                  "rounded-full px-2 py-0.5 text-xs font-bold",
                  stats.percentage === 100
                    ? "bg-emerald-100 text-emerald-800"
                    : stats.percentage > 50
                    ? "bg-brand-100 text-brand-800"
                    : "bg-amber-100 text-amber-800"
                )}
              >
                {stats.percentage}% Done
              </span>
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-ink-900">{stats.percentage}%</span>
              <span className="text-xs text-ink-500">
                ({stats.completed} of {stats.total} tasks completed)
              </span>
            </div>

            {/* Visual Animated Progress Bar */}
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-ink-100">
              <div
                className={clsx(
                  "h-full rounded-full transition-all duration-500",
                  stats.percentage === 100
                    ? "bg-emerald-500"
                    : stats.percentage >= 60
                    ? "bg-brand-600"
                    : "bg-amber-500"
                )}
                style={{ width: `${stats.percentage}%` }}
              />
            </div>

            {/* Department Breakdown Bar */}
            {currentUser.isCeo ? (
              <div className="mt-3 flex items-center justify-between text-[11px] text-ink-500 border-t border-ink-100 pt-2">
                <span className="flex items-center gap-1 text-violet-700 font-medium">
                  <Briefcase size={12} /> BDM: {stats.bdm.done}/{stats.bdm.total} ({stats.bdm.percent}%)
                </span>
                <span className="flex items-center gap-1 text-sky-700 font-medium">
                  <Code2 size={12} /> Tech: {stats.tech.done}/{stats.tech.total} ({stats.tech.percent}%)
                </span>
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-between text-[11px] text-ink-500 border-t border-ink-100 pt-2">
                <span className="flex items-center gap-1 text-ink-700 font-medium">
                  {currentUser.userDepartment === "TECH" ? (
                    <>
                      <Code2 size={12} className="text-sky-600" /> Tech Engineering Progress
                    </>
                  ) : (
                    <>
                      <Briefcase size={12} className="text-violet-600" /> BDM Sales Progress
                    </>
                  )}
                </span>
                <span className="font-bold text-ink-700">
                  {stats.completed} of {stats.total} tasks finished
                </span>
              </div>
            )}
          </div>

          {/* Quick Stat: Total Tasks */}
          <div className="card p-3">
            <div className="text-xs font-medium text-ink-500">Total Work Items</div>
            <div className="mt-1 text-2xl font-bold text-ink-900">{stats.total}</div>
            <div className="mt-1 text-[11px] text-ink-400">Scheduled for this day</div>
          </div>

          {/* Quick Stat: Completed Tasks */}
          <div className="card p-3 border-l-4 border-l-emerald-500">
            <div className="text-xs font-medium text-emerald-700">Completed (Done)</div>
            <div className="mt-1 text-2xl font-bold text-emerald-600">{stats.completed}</div>
            <div className="mt-1 text-[11px] text-emerald-600/80">Kya complete kiya</div>
          </div>

          {/* Quick Stat: Remaining / In-Progress Tasks */}
          <div className="card p-3 border-l-4 border-l-amber-500">
            <div className="text-xs font-medium text-amber-700">Remaining (Pending)</div>
            <div className="mt-1 text-2xl font-bold text-amber-600">{stats.pending}</div>
            <div className="mt-1 text-[11px] text-amber-600/80">Kya bacha gya</div>
          </div>
        </div>
      )}

      {/* Error alert */}
      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center justify-between">
          <span>{err}</span>
          <button onClick={() => setErr(null)} className="text-xs font-bold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. DAY VIEW: To-Do with Checkboxes, Kya Kiya, Kya Bacha */}
      {/* ======================================================== */}
      {view === "day" && (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Main 2-column: Tasks List */}
          <div className="space-y-4 lg:col-span-2">
            {/* Quick Add Bar */}
            <form onSubmit={handleQuickAdd} className="card p-2.5 flex items-center gap-2">
              <span className="text-brand-600 pl-1">
                <Plus size={18} />
              </span>
              <input
                type="text"
                placeholder={`Quick add to-do for ${formatShortDate(selectedDate)}... (Press Enter)`}
                value={quickTaskTitle}
                onChange={(e) => setQuickTaskTitle(e.target.value)}
                className="flex-1 bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400"
              />
              {currentUser.isCeo ? (
                <select
                  value={quickTaskDept}
                  onChange={(e) => setQuickTaskDept(e.target.value as any)}
                  className="rounded-md border border-ink-200 bg-ink-50 px-2 py-1 text-xs font-medium text-ink-700"
                >
                  <option value="BDM">BDM</option>
                  <option value="TECH">TECH</option>
                </select>
              ) : (
                <span
                  className={clsx(
                    "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                    currentUser.userDepartment === "TECH"
                      ? "bg-sky-100 text-sky-800"
                      : "bg-violet-100 text-violet-800"
                  )}
                >
                  {currentUser.userDepartment}
                </span>
              )}
              <button
                type="submit"
                disabled={!quickTaskTitle.trim()}
                className="btn-primary py-1 px-3 text-xs shrink-0"
              >
                Add
              </button>
            </form>

            {/* Section: KYA BACHA GYA (Active / Pending Tasks) */}
            <div className="card p-4">
              <div className="mb-3 flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-ink-700">
                    Kya Bacha Gya (Pending To-Dos)
                  </h2>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                    {currentDayTasks.filter((t) => t.status !== "DONE").length}
                  </span>
                </div>
                <span className="text-xs text-ink-400">Click checkbox to mark done</span>
              </div>

              <div className="space-y-2.5">
                {currentDayTasks.filter((t) => t.status !== "DONE").map((task) => (
                  <div
                    key={task.id}
                    className={clsx(
                      "group rounded-xl border p-3 transition hover:shadow-xs",
                      task.priority === "URGENT"
                        ? "border-red-300 bg-red-50/20"
                        : task.status === "IN_PROGRESS"
                        ? "border-sky-300 bg-sky-50/20"
                        : "border-ink-200 bg-white"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleTaskComplete(task)}
                        className="mt-0.5 text-ink-400 hover:text-emerald-600 transition"
                        title="Mark as completed"
                      >
                        <Square size={20} className="hover:stroke-emerald-600" />
                      </button>

                      <div className="flex-1 min-w-0">
                        {/* Tags Row */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span
                            className={clsx(
                              "rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                              task.department === "BDM"
                                ? "bg-violet-100 text-violet-800"
                                : task.department === "TECH"
                                ? "bg-sky-100 text-sky-800"
                                : "bg-ink-100 text-ink-700"
                            )}
                          >
                            {task.department}
                          </span>

                          {task.category && (
                            <span className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-600">
                              {task.category}
                            </span>
                          )}

                          <span
                            className={clsx(
                              "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                              task.priority === "URGENT"
                                ? "bg-red-100 text-red-800"
                                : task.priority === "HIGH"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-ink-100 text-ink-600"
                            )}
                          >
                            {task.priority}
                          </span>

                          {task.status === "IN_PROGRESS" && (
                            <span className="rounded-md bg-sky-100 text-sky-800 px-1.5 py-0.5 text-[10px] font-bold flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-sky-600 animate-pulse" />
                              IN PROGRESS
                            </span>
                          )}

                          {task.status === "BLOCKED" && (
                            <span className="rounded-md bg-red-100 text-red-800 px-1.5 py-0.5 text-[10px] font-bold">
                              BLOCKED
                            </span>
                          )}
                        </div>

                        {/* Title & Description */}
                        <div className="text-sm font-semibold text-ink-900 leading-snug break-words">
                          {task.title}
                        </div>

                        {task.institution && (
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-brand-600 font-medium">
                            <Building size={12} />
                            <span>{task.institution.legalName}</span>
                          </div>
                        )}

                        {task.description && (
                          <p className="mt-1 text-xs text-ink-600 break-words leading-relaxed">
                            {task.description}
                          </p>
                        )}

                        {/* Meta info & Timestamps: KB KYA KIYA */}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-ink-500">
                          {task.assignee && (
                            <span className="flex items-center gap-1">
                              <User size={12} /> {task.assignee.name}
                            </span>
                          )}

                          <span className="flex items-center gap-1 text-ink-400">
                            <Clock size={12} /> Created: {formatTime(task.createdAt)}
                          </span>

                          {task.startedAt && (
                            <span className="flex items-center gap-1 text-sky-600 font-medium">
                              Started: {formatTime(task.startedAt)}
                            </span>
                          )}

                          {task.estimatedMinutes && (
                            <span>Est: {task.estimatedMinutes}m</span>
                          )}
                        </div>
                      </div>

                      {/* Quick Status dropdown & Actions */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {task.status === "OPEN" && (
                          <button
                            onClick={() => changeTaskStatus(task.id, "IN_PROGRESS", "Started work")}
                            className="rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 hover:bg-sky-100"
                          >
                            Start Work
                          </button>
                        )}

                        {task.status === "IN_PROGRESS" && (
                          <button
                            onClick={() => toggleTaskComplete(task)}
                            className="rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-emerald-700 shadow-2xs"
                          >
                            Mark Done
                          </button>
                        )}

                        <button
                          onClick={() => deleteTask(task.id)}
                          className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-red-600 p-1 transition"
                          title="Delete task"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {currentDayTasks.filter((t) => t.status !== "DONE").length === 0 && (
                  <div className="py-6 text-center text-sm text-ink-400">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-1" />
                    All tasks for this day are completed! 🎉
                  </div>
                )}
              </div>
            </div>

            {/* Section: KYA KYA COMPLETE KIYA (Completed Tasks) */}
            <div className="card p-4 bg-emerald-50/15 border-emerald-200">
              <div className="mb-3 flex items-center justify-between border-b border-emerald-100 pb-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900">
                    Kya Kya Complete Kiya (Completed Work)
                  </h2>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                    {currentDayTasks.filter((t) => t.status === "DONE").length}
                  </span>
                </div>
                <span className="text-xs text-emerald-700 font-medium">
                  {stats.percentage}% of today's work finished
                </span>
              </div>

              <div className="space-y-2">
                {currentDayTasks.filter((t) => t.status === "DONE").map((task) => (
                  <div
                    key={task.id}
                    className="group rounded-xl border border-emerald-200 bg-white p-3 shadow-2xs hover:border-emerald-300 transition"
                  >
                    <div className="flex items-start gap-3">
                      {/* Checked Box */}
                      <button
                        onClick={() => toggleTaskComplete(task)}
                        className="mt-0.5 text-emerald-600 hover:text-ink-400 transition"
                        title="Re-open task"
                      >
                        <CheckSquare size={20} className="fill-emerald-100 text-emerald-600" />
                      </button>

                      <div className="flex-1 min-w-0">
                        {/* Tags */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span
                            className={clsx(
                              "rounded px-1.5 py-0.2 text-[10px] font-bold uppercase",
                              task.department === "BDM"
                                ? "bg-violet-100 text-violet-800"
                                : task.department === "TECH"
                                ? "bg-sky-100 text-sky-800"
                                : "bg-ink-100 text-ink-700"
                            )}
                          >
                            {task.department}
                          </span>
                          <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.2 text-[10px] font-bold flex items-center gap-1">
                            <Check size={10} /> DONE
                          </span>
                        </div>

                        {/* Title & strike */}
                        <div className="text-sm font-medium text-ink-800 line-through decoration-emerald-500">
                          {task.title}
                        </div>

                        {task.description && (
                          <p className="mt-0.5 text-xs text-ink-500 break-words">{task.description}</p>
                        )}

                        {/* Exact Completion Date & Time: KB KYA KIYA */}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-ink-500">
                          {task.completedAt && (
                            <span className="font-semibold text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 size={12} />
                              Completed: {formatDateTime(task.completedAt)}
                            </span>
                          )}

                          {task.assignee && <span>By: {task.assignee.name}</span>}

                          {task.timeSpentMinutes && (
                            <span className="text-ink-500">
                              Time spent: {task.timeSpentMinutes} mins
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => deleteTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-red-600 p-1 transition"
                        title="Delete task"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}

                {currentDayTasks.filter((t) => t.status === "DONE").length === 0 && (
                  <div className="py-4 text-center text-xs text-ink-400">
                    No tasks marked completed yet for this day. Tick checkboxes above as you finish!
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: EOD Report Status & Activity Feed (Date & Time Log) */}
          <div className="space-y-4">
            {/* EOD Maintenance Card */}
            <div className="card p-4 bg-gradient-to-br from-white to-ink-50">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-brand-600" />
                  <h2 className="text-sm font-bold text-ink-900">EOD Maintenance</h2>
                </div>
                {currentDayEod ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    SUBMITTED
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    PENDING
                  </span>
                )}
              </div>

              {currentDayEod ? (
                <div className="mt-3 space-y-2 text-xs">
                  <div className="text-ink-500">
                    Submitted at: <b className="text-ink-700">{formatDateTime(currentDayEod.submittedAt)}</b>
                  </div>
                  <div className="rounded-lg bg-ink-50 p-2.5 space-y-1.5 border border-ink-100">
                    <div>
                      <span className="font-semibold text-ink-700">Summary:</span>
                      <p className="mt-0.5 text-ink-600 whitespace-pre-line">{currentDayEod.summary}</p>
                    </div>
                    {currentDayEod.keyWins && (
                      <div>
                        <span className="font-semibold text-emerald-700">Key Wins:</span>
                        <p className="mt-0.5 text-ink-600">{currentDayEod.keyWins}</p>
                      </div>
                    )}
                    {currentDayEod.blockers && (
                      <div>
                        <span className="font-semibold text-red-700">Blockers:</span>
                        <p className="mt-0.5 text-ink-600">{currentDayEod.blockers}</p>
                      </div>
                    )}
                  </div>
                  <button onClick={openEodModal} className="btn-ghost w-full text-xs mt-2 py-1.5">
                    Update EOD Report
                  </button>
                </div>
              ) : (
                <div className="mt-3 text-xs space-y-2">
                  <p className="text-ink-500">
                    End of Day report is not submitted yet for {formatShortDate(selectedDate)}.
                  </p>
                  <div className="rounded-lg bg-amber-50/60 border border-amber-200 p-2.5 text-amber-900">
                    <b>Today's Progress:</b> {stats.completed} completed, {stats.pending} pending (
                    {stats.percentage}%)
                  </div>
                  <button onClick={openEodModal} className="btn-primary w-full text-xs py-1.5 flex items-center justify-center gap-1">
                    <Send size={13} />
                    <span>Submit EOD Report</span>
                  </button>
                </div>
              )}
            </div>

            {/* Date & Time Activity Log ("Kb Kya Kiya") */}
            <div className="card p-4">
              <div className="mb-3 flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-brand-600" />
                  <h2 className="text-sm font-bold text-ink-900">Activity Log (Kb Kya Kiya)</h2>
                </div>
                <span className="text-[11px] text-ink-400">Timestamps</span>
              </div>

              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {activityLogs.map((log) => (
                  <div key={log.id} className="relative pl-4 text-xs border-l-2 border-brand-200 pb-2">
                    <div className="absolute -left-1.5 top-0.5 h-2.5 w-2.5 rounded-full bg-brand-600" />
                    <div className="flex items-center justify-between gap-1 text-[11px]">
                      <span className="font-semibold text-ink-800">
                        {log.user?.name || "Team member"}
                      </span>
                      <span className="text-ink-400">{formatDateTime(log.createdAt)}</span>
                    </div>

                    <div className="mt-0.5 text-ink-700">
                      <span className="font-medium text-brand-600">{log.action}: </span>
                      {log.note || `Task status updated`}
                    </div>

                    {log.taskTitle && (
                      <div className="mt-0.5 text-[11px] text-ink-500 truncate">
                        Task: <span className="italic">{log.taskTitle}</span>
                      </div>
                    )}
                  </div>
                ))}

                {activityLogs.length === 0 && (
                  <div className="py-6 text-center text-xs text-ink-400">
                    No recent activity logged for this date.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. WEEK VIEW: 7 Days Columns with Interactive Checkboxes */}
      {/* ======================================================== */}
      {view === "week" && (
        <div className="space-y-3">
          <div className="text-xs text-ink-500 flex items-center justify-between">
            <span>Showing all 7 days of the week. Click any task checkbox to complete it directly.</span>
            <span className="font-semibold text-brand-600">Total Week Tasks: {tasks.length}</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 overflow-x-auto">
            {getWeekDays(selectedDate).map((dayStr) => {
              const dayTasks = tasks.filter(
                (t) => (t.scheduledDate || t.createdAt.slice(0, 10)) === dayStr
              );
              const doneCount = dayTasks.filter((t) => t.status === "DONE").length;
              const dayPercent = dayTasks.length > 0 ? Math.round((doneCount / dayTasks.length) * 100) : 0;
              const isSelected = dayStr === selectedDate;
              const isDayToday = dayStr === todayStr;

              return (
                <div
                  key={dayStr}
                  className={clsx(
                    "card min-w-[200px] flex flex-col p-2.5 transition",
                    isSelected ? "ring-2 ring-brand-500" : "",
                    isDayToday ? "border-brand-400 bg-brand-50/10" : ""
                  )}
                >
                  {/* Column Header */}
                  <div
                    onClick={() => setSelectedDate(dayStr)}
                    className="cursor-pointer border-b pb-2 mb-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink-900">
                        {new Date(dayStr).toLocaleDateString("en-IN", { weekday: "short" })}
                      </span>
                      {isDayToday && (
                        <span className="rounded bg-brand-100 px-1.5 py-0.2 text-[10px] font-bold text-brand-700">
                          TODAY
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-500">{formatShortDate(dayStr)}</div>

                    {/* Mini Progress */}
                    <div className="mt-1 flex items-center justify-between text-[10px] font-semibold">
                      <span className="text-ink-500">
                        {doneCount}/{dayTasks.length} done
                      </span>
                      <span
                        className={clsx(
                          dayPercent === 100 ? "text-emerald-600" : "text-brand-600"
                        )}
                      >
                        {dayPercent}%
                      </span>
                    </div>
                    <div className="mt-1 h-1 w-full rounded-full bg-ink-100 overflow-hidden">
                      <div
                        className={clsx(
                          "h-full rounded-full",
                          dayPercent === 100 ? "bg-emerald-500" : "bg-brand-500"
                        )}
                        style={{ width: `${dayPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Tasks List */}
                  <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[380px]">
                    {dayTasks.map((t) => (
                      <div
                        key={t.id}
                        className={clsx(
                          "rounded-lg border p-1.5 text-xs transition",
                          t.status === "DONE"
                            ? "bg-emerald-50/40 border-emerald-200"
                            : "bg-white border-ink-200"
                        )}
                      >
                        <div className="flex items-start gap-1.5">
                          <button
                            onClick={() => toggleTaskComplete(t)}
                            className="mt-0.5 text-ink-400 hover:text-emerald-600 shrink-0"
                          >
                            {t.status === "DONE" ? (
                              <CheckSquare size={14} className="text-emerald-600 fill-emerald-100" />
                            ) : (
                              <Square size={14} />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div
                              className={clsx(
                                "font-medium leading-tight truncate",
                                t.status === "DONE"
                                  ? "line-through text-ink-400"
                                  : "text-ink-900"
                              )}
                            >
                              {t.title}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-ink-400">
                              <span
                                className={clsx(
                                  "font-bold",
                                  t.department === "BDM" ? "text-violet-600" : "text-sky-600"
                                )}
                              >
                                {t.department}
                              </span>
                              {t.completedAt && (
                                <span className="text-emerald-600 font-semibold">
                                  · {formatTime(t.completedAt)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {dayTasks.length === 0 && (
                      <div className="py-8 text-center text-[11px] text-ink-400">No work items</div>
                    )}
                  </div>

                  {/* Quick Add button for this day */}
                  <button
                    onClick={() => {
                      setSelectedDate(dayStr);
                      setTaskForm((prev) => ({ ...prev, scheduledDate: dayStr }));
                      setIsAddModalOpen(true);
                    }}
                    className="mt-2 flex items-center justify-center gap-1 text-[11px] font-semibold text-brand-600 hover:bg-brand-50 py-1 rounded border border-dashed border-brand-200 transition"
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. MONTH VIEW: Full Calendar Month Grid                   */}
      {/* ======================================================== */}
      {view === "month" && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-ink-500">
            <span>Click any day to jump directly into its daily to-do and EOD view.</span>
            <span className="font-semibold text-brand-600">
              Month of {new Date(selectedDate).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name) => (
              <div key={name} className="text-center font-bold text-xs uppercase tracking-wider text-ink-500 py-1">
                {name}
              </div>
            ))}

            {/* Days of Month calculation */}
            {(() => {
              const [y, m] = selectedDate.split("-").map(Number);
              const firstDay = new Date(y, m - 1, 1);
              const lastDay = new Date(y, m, 0);
              const daysInMonth = lastDay.getDate();

              // Day of week for first day (0=Sun, 1=Mon... convert to 0=Mon)
              let startOffset = firstDay.getDay() - 1;
              if (startOffset === -1) startOffset = 6;

              const cells = [];

              // Leading blank days
              for (let i = 0; i < startOffset; i++) {
                cells.push(<div key={`blank-${i}`} className="h-24 rounded-lg bg-ink-50/50" />);
              }

              // Days of month
              for (let d = 1; d <= daysInMonth; d++) {
                const dayStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                const dayTasks = tasks.filter(
                  (t) => (t.scheduledDate || t.createdAt.slice(0, 10)) === dayStr
                );
                const doneCount = dayTasks.filter((t) => t.status === "DONE").length;
                const dayPercent = dayTasks.length > 0 ? Math.round((doneCount / dayTasks.length) * 100) : 0;
                const isDayToday = dayStr === todayStr;
                const isSelected = dayStr === selectedDate;

                cells.push(
                  <div
                    key={dayStr}
                    onClick={() => {
                      setSelectedDate(dayStr);
                      setView("day");
                    }}
                    className={clsx(
                      "h-24 rounded-lg border p-1.5 cursor-pointer transition flex flex-col justify-between hover:border-brand-400 hover:shadow-xs",
                      isSelected ? "ring-2 ring-brand-500" : "",
                      isDayToday ? "border-brand-500 bg-brand-50/30 font-bold" : "border-ink-200 bg-white"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={clsx("text-xs", isDayToday ? "text-brand-600 font-bold" : "text-ink-700")}>
                        {d}
                      </span>
                      {dayTasks.length > 0 && (
                        <span
                          className={clsx(
                            "rounded-full px-1.5 py-0.2 text-[9px] font-bold",
                            dayPercent === 100
                              ? "bg-emerald-100 text-emerald-800"
                              : dayPercent > 0
                              ? "bg-amber-100 text-amber-800"
                              : "bg-ink-100 text-ink-600"
                          )}
                        >
                          {dayPercent}%
                        </span>
                      )}
                    </div>

                    {/* Preview of tasks */}
                    <div className="flex-1 overflow-hidden my-1 space-y-0.5">
                      {dayTasks.slice(0, 2).map((t) => (
                        <div
                          key={t.id}
                          className={clsx(
                            "truncate text-[10px] px-1 rounded",
                            t.status === "DONE"
                              ? "bg-emerald-50 text-emerald-700 line-through"
                              : "bg-ink-100 text-ink-800"
                          )}
                        >
                          {t.title}
                        </div>
                      ))}
                      {dayTasks.length > 2 && (
                        <div className="text-[9px] text-ink-400 pl-1 font-medium">
                          +{dayTasks.length - 2} more
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-ink-400">
                      {dayTasks.length > 0 ? `${doneCount}/${dayTasks.length} done` : ""}
                    </div>
                  </div>
                );
              }

              return cells;
            })()}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. TRELLO / KANBAN BOARD VIEW                             */}
      {/* ======================================================== */}
      {view === "board" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-ink-500">
            <span>Trello-style Kanban workflow. Move tasks between stages or check off when complete.</span>
            <span className="font-semibold text-ink-700">Date: {formatDisplayDate(selectedDate)}</span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4 overflow-x-auto pb-4">
            {/* Column 1: TO DO */}
            <div className="rounded-xl bg-ink-100/70 p-3 min-w-[260px] flex flex-col border border-ink-200">
              <div className="mb-2 flex items-center justify-between px-1">
                <div className="text-xs font-bold uppercase tracking-wider text-ink-700 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-ink-400" />
                  <span>To Do (Backlog)</span>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-ink-700 shadow-2xs">
                  {currentDayTasks.filter((t) => t.status === "OPEN").length}
                </span>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-[550px]">
                {currentDayTasks.filter((t) => t.status === "OPEN").map((t) => (
                  <div key={t.id} className="card p-3 text-xs shadow-xs hover:border-brand-400 transition space-y-2">
                    <div className="flex items-start justify-between gap-1">
                      <span
                        className={clsx(
                          "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                          t.department === "BDM" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800"
                        )}
                      >
                        {t.department}
                      </span>
                      <span className="text-[10px] text-ink-400 font-medium">
                        {formatTime(t.createdAt)}
                      </span>
                    </div>

                    <div className="font-semibold text-ink-900 break-words">{t.title}</div>
                    {t.description && <p className="text-ink-500 text-[11px] break-words">{t.description}</p>}

                    <div className="flex items-center justify-between pt-1 border-t border-ink-100 text-[11px]">
                      <span className="text-ink-500">{t.assignee?.name}</span>
                      <button
                        onClick={() => changeTaskStatus(t.id, "IN_PROGRESS", "Moved to In Progress")}
                        className="rounded bg-sky-50 px-2 py-1 font-semibold text-sky-700 hover:bg-sky-100 flex items-center gap-1"
                      >
                        Start <ArrowRight size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 2: IN PROGRESS */}
            <div className="rounded-xl bg-sky-50/60 p-3 min-w-[260px] flex flex-col border border-sky-200">
              <div className="mb-2 flex items-center justify-between px-1">
                <div className="text-xs font-bold uppercase tracking-wider text-sky-900 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                  <span>In Progress</span>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-sky-800 shadow-2xs">
                  {currentDayTasks.filter((t) => t.status === "IN_PROGRESS").length}
                </span>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-[550px]">
                {currentDayTasks.filter((t) => t.status === "IN_PROGRESS").map((t) => (
                  <div key={t.id} className="card p-3 text-xs shadow-xs border-sky-300 space-y-2">
                    <div className="flex items-start justify-between gap-1">
                      <span
                        className={clsx(
                          "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                          t.department === "BDM" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800"
                        )}
                      >
                        {t.department}
                      </span>
                      <span className="text-[10px] text-sky-600 font-semibold">
                        Started: {formatTime(t.startedAt || t.createdAt)}
                      </span>
                    </div>

                    <div className="font-semibold text-ink-900 break-words">{t.title}</div>
                    {t.description && <p className="text-ink-500 text-[11px] break-words">{t.description}</p>}

                    <div className="flex items-center justify-between pt-1 border-t border-sky-100 text-[11px]">
                      <button
                        onClick={() => changeTaskStatus(t.id, "BLOCKED", "Blocked")}
                        className="text-red-600 hover:underline"
                      >
                        Block
                      </button>
                      <button
                        onClick={() => toggleTaskComplete(t)}
                        className="rounded bg-emerald-600 px-2 py-1 font-semibold text-white hover:bg-emerald-700 flex items-center gap-1 shadow-2xs"
                      >
                        <Check size={12} /> Done
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 3: BLOCKED */}
            <div className="rounded-xl bg-red-50/50 p-3 min-w-[260px] flex flex-col border border-red-200">
              <div className="mb-2 flex items-center justify-between px-1">
                <div className="text-xs font-bold uppercase tracking-wider text-red-900 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span>Blocked / On Hold</span>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-red-800 shadow-2xs">
                  {currentDayTasks.filter((t) => t.status === "BLOCKED").length}
                </span>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-[550px]">
                {currentDayTasks.filter((t) => t.status === "BLOCKED").map((t) => (
                  <div key={t.id} className="card p-3 text-xs shadow-xs border-red-300 space-y-2">
                    <div className="flex items-start justify-between gap-1">
                      <span className="rounded bg-red-100 text-red-800 px-1.5 py-0.5 text-[10px] font-bold">
                        {t.department}
                      </span>
                    </div>

                    <div className="font-semibold text-ink-900 break-words">{t.title}</div>
                    {t.description && <p className="text-ink-500 text-[11px] break-words">{t.description}</p>}

                    <div className="flex items-center justify-between pt-1 border-t border-red-100 text-[11px]">
                      <button
                        onClick={() => changeTaskStatus(t.id, "IN_PROGRESS", "Unblocked and resumed")}
                        className="rounded bg-sky-50 px-2 py-1 font-semibold text-sky-700 hover:bg-sky-100"
                      >
                        Unblock
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 4: COMPLETED (DONE) */}
            <div className="rounded-xl bg-emerald-50/50 p-3 min-w-[260px] flex flex-col border border-emerald-200">
              <div className="mb-2 flex items-center justify-between px-1">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Completed (Done)</span>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-emerald-800 shadow-2xs">
                  {currentDayTasks.filter((t) => t.status === "DONE").length}
                </span>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-[550px]">
                {currentDayTasks.filter((t) => t.status === "DONE").map((t) => (
                  <div key={t.id} className="card p-3 text-xs shadow-xs border-emerald-300 bg-white space-y-2">
                    <div className="flex items-start justify-between gap-1">
                      <span
                        className={clsx(
                          "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                          t.department === "BDM" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800"
                        )}
                      >
                        {t.department}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-bold">
                        {formatTime(t.completedAt)}
                      </span>
                    </div>

                    <div className="font-medium text-ink-800 line-through decoration-emerald-500 break-words">
                      {t.title}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-emerald-100 text-[11px]">
                      <span className="text-ink-500">{t.assignee?.name}</span>
                      <button
                        onClick={() => toggleTaskComplete(t)}
                        className="text-ink-400 hover:text-ink-700 text-[10px]"
                      >
                        Re-open
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. EOD REPORTS ARCHIVE & SUBMISSION VIEW                   */}
      {/* ======================================================== */}
      {view === "eod" && (
        <div className="space-y-4">
          <div className="card p-4 bg-gradient-to-r from-brand-50/50 to-violet-50/40 border-brand-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-ink-900">End-of-Day (EOD) Maintenance</h2>
              <p className="text-xs text-ink-600 mt-0.5">
                Maintain comprehensive daily work logs for BDM and Tech teams. Date & time audit trails preserved.
              </p>
            </div>
            <button onClick={openEodModal} className="btn-primary py-2 px-4 text-xs font-semibold">
              <FileText size={15} />
              <span>{currentDayEod ? "Update EOD for Selected Date" : "Submit EOD for Selected Date"}</span>
            </button>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-ink-600">
              Submitted EOD Reports History
            </h3>

            <div className="grid gap-3 md:grid-cols-2">
              {eodReports.map((report) => (
                <div key={report.id} className="card p-4 space-y-3 hover:border-brand-300 transition">
                  <div className="flex items-start justify-between gap-2 border-b pb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ink-900">
                          {formatDisplayDate(report.reportDate)}
                        </span>
                        <span
                          className={clsx(
                            "rounded px-1.5 py-0.5 text-[10px] font-bold",
                            report.department === "BDM"
                              ? "bg-violet-100 text-violet-800"
                              : "bg-sky-100 text-sky-800"
                          )}
                        >
                          {report.department}
                        </span>
                      </div>
                      <div className="text-xs text-ink-500 mt-0.5">
                        Submitted by <b>{report.user?.name}</b> · {formatDateTime(report.submittedAt)}
                      </div>
                    </div>

                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                      {report.completionRate}% Done
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="font-semibold text-ink-700">Summary:</span>
                      <p className="mt-0.5 text-ink-600 whitespace-pre-line bg-ink-50 p-2 rounded border border-ink-100">
                        {report.summary}
                      </p>
                    </div>

                    {report.keyWins && (
                      <div>
                        <span className="font-semibold text-emerald-700">Key Wins:</span>
                        <p className="mt-0.5 text-ink-600">{report.keyWins}</p>
                      </div>
                    )}

                    {report.blockers && (
                      <div>
                        <span className="font-semibold text-red-700">Blockers:</span>
                        <p className="mt-0.5 text-ink-600">{report.blockers}</p>
                      </div>
                    )}

                    {report.planForTomorrow && (
                      <div>
                        <span className="font-semibold text-ink-700">Plan for Tomorrow:</span>
                        <p className="mt-0.5 text-ink-600">{report.planForTomorrow}</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t text-[11px] text-ink-400 flex items-center justify-between">
                    <span>Hours logged: {report.hoursSpent} hrs</span>
                    <span>
                      Tasks: {report.tasksCompletedCount} completed / {report.tasksPendingCount} pending
                    </span>
                  </div>
                </div>
              ))}

              {eodReports.length === 0 && (
                <div className="col-span-2 py-12 text-center text-sm text-ink-400 card">
                  No EOD reports submitted yet. Submit an EOD report for today using the button above!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD DETAILED WORK ITEM / TASK                      */}
      {/* ======================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-lg p-5 bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h2 className="text-base font-bold text-ink-900">Add Work Item / To-Do</h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-ink-400 hover:text-ink-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDetailedTaskSubmit} className="space-y-3.5">
              <div>
                <label className="lbl">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. In-person visit to Pune credit society / Database vacuum"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="lbl">Department *</label>
                  {currentUser.isCeo ? (
                    <select
                      value={taskForm.department}
                      onChange={(e) => setTaskForm({ ...taskForm, department: e.target.value as any })}
                      className="input"
                    >
                      <option value="BDM">BDM (Sales & Partnerships)</option>
                      <option value="TECH">TECH (Engineering & DevOps)</option>
                      <option value="GENERAL">General</option>
                    </select>
                  ) : (
                    <div className="input bg-ink-50 font-semibold text-ink-700 flex items-center">
                      {currentUser.userDepartment === "TECH" ? "TECH (Engineering & DevOps)" : "BDM (Sales & Partnerships)"}
                    </div>
                  )}
                </div>

                <div>
                  <label className="lbl">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Field Visit, Demo, Bug Fix"
                    value={taskForm.category}
                    onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="lbl">Scheduled Date *</label>
                  <input
                    type="date"
                    required
                    value={taskForm.scheduledDate}
                    onChange={(e) => setTaskForm({ ...taskForm, scheduledDate: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="lbl">Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                    className="input"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="lbl">Assign To</label>
                  <select
                    value={taskForm.assigneeId}
                    onChange={(e) => setTaskForm({ ...taskForm, assigneeId: e.target.value })}
                    className="input"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role.name.split(" ")[0]})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="lbl">Estimated Time (mins)</label>
                  <input
                    type="number"
                    min="5"
                    max="1440"
                    value={taskForm.estimatedMinutes}
                    onChange={(e) => setTaskForm({ ...taskForm, estimatedMinutes: Number(e.target.value) })}
                    className="input"
                  />
                </div>
              </div>

              {taskForm.department === "BDM" && (
                <div>
                  <label className="lbl">Co-operative Society / Institution (Optional)</label>
                  <select
                    value={taskForm.institutionId}
                    onChange={(e) => setTaskForm({ ...taskForm, institutionId: e.target.value })}
                    className="input"
                  >
                    <option value="">None / Not linked to society</option>
                    {institutions.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.legalName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="lbl">Details & Notes</label>
                <textarea
                  rows={2}
                  placeholder="Key discussion points, agenda, or technical notes..."
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="input"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: SUBMIT / EDIT EOD REPORT                           */}
      {/* ======================================================== */}
      {isEodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-lg p-5 bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-ink-900">
                  End of Day (EOD) Report — {formatShortDate(selectedDate)}
                </h2>
                <p className="text-xs text-ink-500">
                  Daily summary of achievements, progress percentage, and tomorrow's plan.
                </p>
              </div>
              <button
                onClick={() => setIsEodModalOpen(false)}
                className="text-ink-400 hover:text-ink-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEodSubmit} className="space-y-3.5">
              {/* Daily Progress summary indicator */}
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-900 flex items-center justify-between">
                <span>
                  <b>Tasks Status:</b> {stats.completed} Completed · {stats.pending} Pending
                </span>
                <span className="font-bold text-emerald-800">{stats.percentage}% Finished</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="lbl">Department *</label>
                  {currentUser.isCeo ? (
                    <select
                      value={eodForm.department}
                      onChange={(e) => setEodForm({ ...eodForm, department: e.target.value as any })}
                      className="input"
                    >
                      <option value="BDM">BDM (Sales)</option>
                      <option value="TECH">TECH (Engineering)</option>
                      <option value="GENERAL">General</option>
                    </select>
                  ) : (
                    <div className="input bg-ink-50 font-semibold text-ink-700 flex items-center">
                      {currentUser.userDepartment === "TECH" ? "TECH (Engineering)" : "BDM (Sales)"}
                    </div>
                  )}
                </div>

                <div>
                  <label className="lbl">Hours Worked Today *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="24"
                    required
                    value={eodForm.hoursSpent}
                    onChange={(e) => setEodForm({ ...eodForm, hoursSpent: Number(e.target.value) })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="lbl">Today's Work Summary *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Summarize key tasks finished, meetings conducted, code pushed..."
                  value={eodForm.summary}
                  onChange={(e) => setEodForm({ ...eodForm, summary: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="lbl">Key Wins & Highlights</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Society chairman agreed to proposal demo / Index optimization lowered query time by 90%..."
                  value={eodForm.keyWins}
                  onChange={(e) => setEodForm({ ...eodForm, keyWins: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="lbl">Blockers & Roadblocks (if any)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Waiting for society committee approval / API rate limit reached..."
                  value={eodForm.blockers}
                  onChange={(e) => setEodForm({ ...eodForm, blockers: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="lbl">Plan for Tomorrow</label>
                <textarea
                  rows={2}
                  placeholder="Top 3 priority items to accomplish tomorrow..."
                  value={eodForm.planForTomorrow}
                  onChange={(e) => setEodForm({ ...eodForm, planForTomorrow: e.target.value })}
                  className="input"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsEodModalOpen(false)}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <Send size={14} /> Submit EOD
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

