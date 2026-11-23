"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  Activity,
  Clock,
  MapPin,
  Globe,
  Shield,
  User,
  Laptop,
  Smartphone,
  Monitor,
  RefreshCw,
  Search,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  LogIn,
  LogOut,
  ExternalLink,
  Filter,
} from "lucide-react";
import { formatDuration } from "@/lib/geo";
import { dtt, dt } from "@/lib/format";

type StaffMember = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  roleKey: string;
  roleName: string;
  teamName?: string | null;
  lastLoginAt?: string | null;
  isOnline: boolean;
  currentSession?: any;
  todayDurationSeconds: number;
  todayDurationFormatted: string;
  todaySessionCount: number;
  todayActivityCount: number;
  lastActionTitle?: string | null;
  lastActionAt?: string | null;
  lastActionRoute?: string | null;
  lastAddress?: string | null;
  lastIp?: string | null;
};

type SessionRecord = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  roleKey: string;
  roleName: string;
  loginAt: string;
  logoutAt?: string | null;
  lastActiveAt: string;
  durationSeconds: number;
  durationFormatted: string;
  ip?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  postalCode?: string | null;
  isp?: string | null;
  address?: string | null;
  deviceType?: string | null;
  browser?: string | null;
  os?: string | null;
  status: "ACTIVE" | "LOGGED_OUT" | "TIMED_OUT";
  activityCount: number;
};

type ActivityRecord = {
  id: number;
  sessionId?: string | null;
  userId: string;
  userName: string;
  userEmail: string;
  roleKey: string;
  activityType: string;
  title: string;
  route?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  details?: any;
  ip?: string | null;
  location?: string | null;
  createdAt: string;
};

export function StaffMonitorClient({
  initialData,
}: {
  initialData: {
    staff: StaffMember[];
    sessions: SessionRecord[];
    activities: ActivityRecord[];
    summary: {
      totalMonitoredStaff: number;
      currentlyOnline: number;
      totalHoursTodayFormatted: string;
      totalActionsToday: number;
      totalSessionsToday: number;
    };
  };
}) {
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState<"sessions" | "activities" | "staff">("sessions");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "TECH" | "BDM">("ALL");
  const [selectedUser, setSelectedUser] = useState<string>("ALL");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [range, setRange] = useState<"today" | "yesterday" | "7days" | "30days" | "all">("today");
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  async function loadData() {
    setIsRefreshing(true);
    try {
      const q = new URLSearchParams();
      if (roleFilter !== "ALL") q.set("role", roleFilter);
      if (selectedUser !== "ALL") q.set("userId", selectedUser);
      if (selectedSessionId) q.set("sessionId", selectedSessionId);
      q.set("range", range);
      if (activityTypeFilter !== "ALL") q.set("activityType", activityTypeFilter);
      if (search.trim()) q.set("search", search.trim());

      const res = await fetch(`/api/admin/staff-monitor?${q.toString()}`);
      if (res.ok) {
        const json = await res.json();
        startTransition(() => {
          setData(json);
        });
      }
    } catch (e) {
      console.error("Failed to load staff monitor data", e);
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [roleFilter, selectedUser, selectedSessionId, range, activityTypeFilter]);

  // Auto-refresh interval (every 20 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData();
    }, 20000);
    return () => clearInterval(interval);
  }, [autoRefresh, roleFilter, selectedUser, selectedSessionId, range, activityTypeFilter, search]);

  const getActivityBadgeColor = (type?: string | null) => {
    const cleanType = String(type || "ACTION").toUpperCase();
    switch (cleanType) {
      case "PAGE_VIEW":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "LOGIN":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "LOGOUT":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "TASK":
      case "TASK_UPDATE":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "DEAL":
      case "DEAL_UPDATE":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "LEAD":
      case "LEAD_UPDATE":
        return "bg-teal-50 text-teal-700 border-teal-200";
      case "QUOTE":
      case "QUOTE_CREATE":
        return "bg-cyan-50 text-cyan-700 border-cyan-200";
      case "EXPORT":
        return "bg-orange-50 text-orange-700 border-orange-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <div className="card p-3.5 bg-gradient-to-br from-white to-ink-50/40">
          <div className="flex items-center justify-between text-xs font-medium text-ink-500">
            <span>Currently Active</span>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">
            {data.summary.currentlyOnline}
            <span className="text-xs font-normal text-ink-400 ml-1">/ {data.summary.totalMonitoredStaff} online</span>
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">Tech & BDM Staff</div>
        </div>

        <div className="card p-3.5">
          <div className="text-xs font-medium text-ink-500 flex items-center justify-between">
            <span>Today's Total Hours</span>
            <Clock size={14} className="text-brand-500" />
          </div>
          <div className="mt-1 text-xl font-bold text-brand-600">{data.summary.totalHoursTodayFormatted}</div>
          <div className="text-[11px] text-ink-500 mt-0.5">Combined login duration</div>
        </div>

        <div className="card p-3.5">
          <div className="text-xs font-medium text-ink-500 flex items-center justify-between">
            <span>Sessions Today</span>
            <LogIn size={14} className="text-violet-500" />
          </div>
          <div className="mt-1 text-2xl font-bold text-violet-600">{data.summary.totalSessionsToday}</div>
          <div className="text-[11px] text-ink-500 mt-0.5">Total logins recorded</div>
        </div>

        <div className="card p-3.5">
          <div className="text-xs font-medium text-ink-500 flex items-center justify-between">
            <span>Total Actions Logged</span>
            <Activity size={14} className="text-blue-500" />
          </div>
          <div className="mt-1 text-2xl font-bold text-blue-600">{data.summary.totalActionsToday}</div>
          <div className="text-[11px] text-ink-500 mt-0.5">Clicks, pages & CRM updates</div>
        </div>

        <div className="col-span-2 sm:col-span-4 lg:col-span-1 card p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-500">Live Auto-Sync</span>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={clsx(
                "px-2 py-0.5 text-[11px] font-semibold rounded-full border transition",
                autoRefresh
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                  : "bg-slate-100 text-slate-600 border-slate-300"
              )}
            >
              {autoRefresh ? "ON (20s)" : "PAUSED"}
            </button>
          </div>
          <button
            onClick={loadData}
            disabled={isRefreshing}
            className="btn-ghost mt-2 w-full justify-center text-xs py-1.5 flex items-center gap-1.5 border border-ink-200"
          >
            <RefreshCw size={13} className={clsx(isRefreshing && "animate-spin text-brand-600")} />
            {isRefreshing ? "Refreshing..." : "Refresh Now"}
          </button>
        </div>
      </div>

      {/* Live Staff Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-semibold text-ink-700 uppercase tracking-wider flex items-center gap-1.5">
            <User size={15} className="text-brand-600" />
            Monitored Staff Members (Tech Team & Sales BDMs)
          </h2>
          <span className="text-xs text-ink-500">Live status updates automatically</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.staff.map((s) => (
            <div
              key={s.id}
              onClick={() => {
                setSelectedUser(selectedUser === s.id ? "ALL" : s.id);
                setSelectedSessionId(null);
              }}
              className={clsx(
                "card p-4 cursor-pointer transition hover:border-brand-400 relative overflow-hidden",
                selectedUser === s.id && "ring-2 ring-brand-500 border-brand-500 bg-brand-50/20",
                s.isOnline ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-slate-300"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink-900 truncate">{s.name}</span>
                    <span
                      className={clsx(
                        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                        s.roleKey === "BDM"
                          ? "bg-purple-100 text-purple-700"
                          : s.roleKey === "TECH_ADMIN"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-700"
                      )}
                    >
                      {s.roleKey === "BDM" ? "Sales BDM" : s.roleKey === "TECH_ADMIN" ? "Tech Admin" : s.roleName}
                    </span>
                  </div>
                  <div className="text-xs text-ink-500 truncate mt-0.5">{s.email}</div>
                </div>

                <div>
                  {s.isOnline ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                      ONLINE
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                      OFFLINE
                    </span>
                  )}
                </div>
              </div>

              {/* Status details */}
              <div className="mt-3 space-y-1.5 text-xs text-ink-600 border-t border-ink-100 pt-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-ink-500 flex items-center gap-1">
                    <Clock size={12} /> Today's Active Time:
                  </span>
                  <span className="font-semibold text-ink-900">{s.todayDurationFormatted}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-ink-500 flex items-center gap-1">
                    <Activity size={12} /> Today's Actions:
                  </span>
                  <span className="font-semibold text-ink-900">{s.todayActivityCount} activities</span>
                </div>

                <div className="flex items-start justify-between gap-1">
                  <span className="text-ink-500 flex items-center gap-1 shrink-0">
                    <MapPin size={12} /> Login Location:
                  </span>
                  <span className="text-right text-ink-800 font-medium truncate max-w-[170px]" title={s.lastAddress || s.lastIp || "Pune, Maharashtra"}>
                    {s.lastAddress || s.lastIp || "Pune, Maharashtra"}
                  </span>
                </div>

                {s.isOnline && s.lastActionRoute && (
                  <div className="flex items-center justify-between text-[11px] bg-emerald-50 text-emerald-800 px-2 py-1 rounded border border-emerald-200/60 mt-1">
                    <span className="truncate">Currently on: <code className="font-mono font-semibold">{s.lastActionRoute}</code></span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-ink-400">
                <span>{s.todaySessionCount} session(s) today</span>
                <span className="text-brand-600 font-medium hover:underline">
                  {selectedUser === s.id ? "Showing Filtered Logs ✓" : "Click to Filter →"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Controls & Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-ink-100/60 p-1 rounded-lg">
            <button
              onClick={() => setTab("sessions")}
              className={clsx(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5",
                tab === "sessions" ? "bg-white text-ink-900 shadow-xs" : "text-ink-600 hover:text-ink-900"
              )}
            >
              <LogIn size={13} />
              Login Sessions & Attendance ({data.sessions.length})
            </button>
            <button
              onClick={() => setTab("activities")}
              className={clsx(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5",
                tab === "activities" ? "bg-white text-ink-900 shadow-xs" : "text-ink-600 hover:text-ink-900"
              )}
            >
              <Activity size={13} />
              Full Activity Trail ({data.activities.length})
            </button>
          </div>

          {/* Active session filter clear indicator */}
          {selectedSessionId && (
            <div className="flex items-center gap-2 bg-brand-50 border border-brand-200 text-brand-800 px-2.5 py-1 rounded-full text-xs">
              <span>Filtered to Session: <code>{selectedSessionId.slice(0, 8)}...</code></span>
              <button
                onClick={() => setSelectedSessionId(null)}
                className="text-brand-600 hover:text-brand-900 font-bold ml-1"
                title="Clear session filter"
              >
                ✕
              </button>
            </div>
          )}

          {/* User filter clear indicator */}
          {selectedUser !== "ALL" && (
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 text-purple-800 px-2.5 py-1 rounded-full text-xs">
              <span>Employee: <b>{data.staff.find((x) => x.id === selectedUser)?.name || selectedUser}</b></span>
              <button
                onClick={() => setSelectedUser("ALL")}
                className="text-purple-600 hover:text-purple-900 font-bold ml-1"
                title="Clear user filter"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
          <div>
            <label className="block text-[11px] font-medium text-ink-500 mb-1">Team / Department</label>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value as any);
                setSelectedUser("ALL");
              }}
              className="input text-xs py-1.5 w-full"
            >
              <option value="ALL">All Monitored Staff</option>
              <option value="BDM">Sales Team (BDMs)</option>
              <option value="TECH">Tech Team (Tech Admins)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-ink-500 mb-1">Employee</label>
            <select
              value={selectedUser}
              onChange={(e) => {
                setSelectedUser(e.target.value);
                setSelectedSessionId(null);
              }}
              className="input text-xs py-1.5 w-full"
            >
              <option value="ALL">All Employees</option>
              {data.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.roleKey})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-ink-500 mb-1">Date Range</label>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as any)}
              className="input text-xs py-1.5 w-full"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {tab === "activities" && (
            <div>
              <label className="block text-[11px] font-medium text-ink-500 mb-1">Activity Category</label>
              <select
                value={activityTypeFilter}
                onChange={(e) => setActivityTypeFilter(e.target.value)}
                className="input text-xs py-1.5 w-full"
              >
                <option value="ALL">All Event Types</option>
                <option value="PAGE_VIEW">Page Views (Navigation)</option>
                <option value="ACTION">Button / Form Actions</option>
                <option value="LOGIN">Logins</option>
                <option value="LOGOUT">Logouts</option>
                <option value="TASK_UPDATE">Task Updates</option>
                <option value="DEAL_UPDATE">Deal Movements</option>
                <option value="LEAD_UPDATE">Lead Edits</option>
                <option value="QUOTE_CREATE">Quotes Generated</option>
                <option value="EXPORT">Data Exports</option>
              </select>
            </div>
          )}

          <div className={clsx(tab !== "activities" && "lg:col-span-2")}>
            <label className="block text-[11px] font-medium text-ink-500 mb-1">Search Keywords</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, IP, address, action..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadData()}
                className="input text-xs py-1.5 w-full pl-8"
              />
              <Search size={14} className="absolute left-2.5 top-2.5 text-ink-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Tab 1: Sessions & Attendance History */}
      {tab === "sessions" && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 bg-ink-50/50 border-b border-ink-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-ink-900">Login & Logout History with Addresses & Durations</h3>
              <p className="text-xs text-ink-500">
                Exact login timestamps, logout times, session duration, IP addresses, geolocations and devices.
              </p>
            </div>
            <span className="text-xs font-semibold text-ink-600 bg-white px-2 py-1 rounded border border-ink-200">
              {data.sessions.length} session records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-100 text-xs">
              <thead className="bg-ink-50/70 font-semibold text-ink-600 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 text-left">Employee</th>
                  <th className="py-2.5 px-3 text-left">Status</th>
                  <th className="py-2.5 px-3 text-left">Login Time (कब login हुई)</th>
                  <th className="py-2.5 px-3 text-left">Logout Time (कब logout की)</th>
                  <th className="py-2.5 px-3 text-left">Duration (कितना देर तक)</th>
                  <th className="py-2.5 px-3 text-left">Login Address & ISP (कौन सा address पे)</th>
                  <th className="py-2.5 px-3 text-left">IP & Device</th>
                  <th className="py-2.5 px-3 text-center">Activities</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {data.sessions.map((sess) => (
                  <tr key={sess.id} className="hover:bg-ink-50/50 transition">
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-semibold text-ink-900">{sess.userName}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span
                          className={clsx(
                            "px-1.5 py-0.2 rounded text-[10px] font-bold",
                            sess.roleKey === "BDM"
                              ? "bg-purple-100 text-purple-700"
                              : sess.roleKey === "TECH_ADMIN"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-700"
                          )}
                        >
                          {sess.roleKey}
                        </span>
                        <span className="text-[11px] text-ink-400">{sess.userEmail}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      {sess.status === "ACTIVE" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          ACTIVE NOW
                        </span>
                      ) : sess.status === "LOGGED_OUT" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          <CheckCircle2 size={11} className="text-slate-500" />
                          LOGGED OUT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertCircle size={11} className="text-amber-500" />
                          TIMED OUT
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap text-ink-800 font-medium">
                      <div className="flex items-center gap-1.5">
                        <LogIn size={13} className="text-emerald-600 shrink-0" />
                        <span>{dtt(sess.loginAt)}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      {sess.logoutAt ? (
                        <div className="flex items-center gap-1.5 text-ink-800">
                          <LogOut size={13} className="text-amber-600 shrink-0" />
                          <span>{dtt(sess.logoutAt)}</span>
                        </div>
                      ) : (
                        <span className="text-emerald-600 font-semibold italic flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Still Logged In
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="font-bold text-ink-900 bg-brand-50/80 text-brand-800 px-2 py-0.5 rounded border border-brand-200/50">
                        {sess.durationFormatted}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-start gap-1 max-w-[240px]">
                        <MapPin size={13} className="text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-ink-900 leading-tight">
                            {sess.address || `${sess.city || "Pune"}, ${sess.region || "Maharashtra"}`}
                          </div>
                          {sess.isp && <div className="text-[11px] text-ink-500">{sess.isp}</div>}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-mono text-[11px] text-ink-700 font-medium">{sess.ip || "—"}</div>
                      <div className="text-[11px] text-ink-500 flex items-center gap-1 mt-0.5">
                        {sess.deviceType === "Mobile" ? <Smartphone size={11} /> : <Laptop size={11} />}
                        <span>{sess.browser || "Chrome"} on {sess.os || "macOS"}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap text-center">
                      <span className="font-bold text-ink-800 bg-ink-100 px-2 py-0.5 rounded-full text-[11px]">
                        {sess.activityCount} actions
                      </span>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap text-right">
                      <button
                        onClick={() => {
                          setSelectedSessionId(sess.id);
                          setTab("activities");
                        }}
                        className="btn-ghost text-xs py-1 px-2 border border-ink-200 hover:border-brand-500 hover:text-brand-600"
                        title="View all activities for this login session"
                      >
                        View Trail →
                      </button>
                    </td>
                  </tr>
                ))}

                {!data.sessions.length && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-sm text-ink-400">
                      No sessions found matching selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Full Activity Trail */}
      {tab === "activities" && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 bg-ink-50/50 border-b border-ink-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-ink-900">
                Detailed Activity Stream (क्या क्या कर रही है — सारा Logs)
              </h3>
              <p className="text-xs text-ink-500">
                Every page view, button click, deal update, lead edit, task change, and CRM action in real time.
              </p>
            </div>
            <span className="text-xs font-semibold text-ink-600 bg-white px-2 py-1 rounded border border-ink-200">
              {data.activities.length} activity entries
            </span>
          </div>

          <div className="divide-y divide-ink-100">
            {data.activities.map((act: any) => {
              const isExpanded = expandedLogId === act.id;
              const rawType = act.activityType || act.activity_type || "ACTION";
              const badgeClass = getActivityBadgeColor(rawType);
              const userName = act.userName || act.user_name || "Employee";
              const roleKey = act.roleKey || act.role_key || "USER";
              const createdAt = act.createdAt || act.created_at;

              return (
                <div key={act.id} className="p-3.5 hover:bg-ink-50/40 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Activity Category Badge */}
                      <span
                        className={clsx(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shrink-0 mt-0.5",
                          badgeClass
                        )}
                      >
                        {String(rawType).replace(/_/g, " ")}
                      </span>

                      {/* Content */}
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-ink-900 flex items-center gap-2 flex-wrap">
                          <span>{act.title}</span>
                          {act.route && (
                            <span className="font-mono text-[11px] font-normal text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded">
                              {act.route}
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-ink-500 flex items-center gap-3 mt-1 flex-wrap">
                          <span className="font-medium text-ink-700 flex items-center gap-1">
                            <User size={11} /> {userName}
                            <span className="text-[10px] bg-ink-100 px-1 rounded text-ink-500 font-normal">
                              {roleKey}
                            </span>
                          </span>

                          <span className="flex items-center gap-1">
                            <Clock size={11} /> {dtt(createdAt)}
                          </span>

                          {act.location && (
                            <span className="flex items-center gap-1 text-ink-600">
                              <MapPin size={11} className="text-red-500" /> {act.location}
                            </span>
                          )}

                          {act.ip && (
                            <span className="font-mono text-[10px] text-ink-400">IP: {act.ip}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expand Details Button */}
                    {act.details && Object.keys(act.details).length > 0 && (
                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : act.id)}
                        className="text-xs text-brand-600 hover:text-brand-800 font-medium shrink-0 flex items-center gap-0.5 py-0.5 px-1.5 rounded hover:bg-brand-50"
                      >
                        {isExpanded ? "Hide Details" : "View Payload"}
                        <ChevronDown size={13} className={clsx("transition transform", isExpanded && "rotate-180")} />
                      </button>
                    )}
                  </div>

                  {/* Expanded JSON details */}
                  {isExpanded && act.details && (
                    <div className="mt-2.5 p-3 rounded-lg bg-slate-900 text-slate-100 text-[11px] font-mono overflow-auto max-h-60 border border-slate-700">
                      <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                        Event Metadata & Payloads:
                      </div>
                      <pre className="whitespace-pre-wrap">{JSON.stringify(act.details, null, 2)}</pre>
                    </div>
                  )}
                </div>
              );
            })}

            {!data.activities.length && (
              <div className="py-10 text-center text-sm text-ink-400">
                No activity logs found for selected criteria.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
