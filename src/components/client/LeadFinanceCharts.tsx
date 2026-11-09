"use client";

import React, { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
} from "recharts";
import { BarChart3, AlertCircle } from "lucide-react";
import { inr, num } from "@/lib/format";

export interface YearWiseMetricItem {
  year: string;
  milestone?: string | null;
  deposits?: number | null;
  loans?: number | null;
  netWorth?: number | null;
  branches?: number | null;
}

interface LeadFinanceProps {
  totalMembers: number | null;
  activeMembers: number | null;
  totalDeposits: number | null;
  loanBook: number | null;
  totalAssets: number | null;
  annualProfit: number | null;
  netWorth: number | null;
  branchCount: number | null;
  financialYear: string | null;
  investments?: number | null;
  cdRatio?: number | null;
  crar?: number | null;
  yearWiseMetrics?: YearWiseMetricItem[] | null;
}

const COLORS = ["#2563eb", "#06b6d4", "#10b981", "#7c3aed", "#f59e0b", "#ec4899"];

export function LeadFinanceCharts({
  totalMembers,
  activeMembers,
  totalDeposits,
  loanBook,
  totalAssets,
  annualProfit,
  netWorth,
  branchCount,
  financialYear,
  investments,
  cdRatio,
  crar,
  yearWiseMetrics,
}: LeadFinanceProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "distribution" | "growth">("overview");

  // STRICT CHECK: Only consider actual verified financial figures
  const hasActualFinancials =
    (totalDeposits != null && totalDeposits > 0) ||
    (loanBook != null && loanBook > 0) ||
    (totalAssets != null && totalAssets > 0) ||
    (annualProfit != null && annualProfit > 0) ||
    (netWorth != null && netWorth > 0);

  // Build bar chart data STRICTLY from actual reported numbers
  const barData: { name: string; amount: number; inCrores: number; fill: string }[] = [];

  if (totalDeposits != null && totalDeposits > 0) {
    barData.push({
      name: "Total Deposits",
      amount: totalDeposits,
      inCrores: Number((totalDeposits / 1e7).toFixed(2)),
      fill: "#2563eb",
    });
  }
  if (loanBook != null && loanBook > 0) {
    barData.push({
      name: "Loan Book (Advances)",
      amount: loanBook,
      inCrores: Number((loanBook / 1e7).toFixed(2)),
      fill: "#06b6d4",
    });
  }
  if (totalAssets != null && totalAssets > 0) {
    barData.push({
      name: "Working Capital / Assets",
      amount: totalAssets,
      inCrores: Number((totalAssets / 1e7).toFixed(2)),
      fill: "#7c3aed",
    });
  }
  if (investments != null && investments > 0) {
    barData.push({
      name: "Investments",
      amount: investments,
      inCrores: Number((investments / 1e7).toFixed(2)),
      fill: "#3b82f6",
    });
  }
  if (netWorth != null && netWorth > 0) {
    barData.push({
      name: "Own Funds / Net Worth",
      amount: netWorth,
      inCrores: Number((netWorth / 1e7).toFixed(2)),
      fill: "#10b981",
    });
  }
  if (annualProfit != null && annualProfit > 0) {
    barData.push({
      name: "Annual Net Profit",
      amount: annualProfit,
      inCrores: Number((annualProfit / 1e7).toFixed(2)),
      fill: "#f59e0b",
    });
  }

  // Distribution pie data only if actual deposits and loans are present
  const distributionPieData =
    totalDeposits != null && totalDeposits > 0
      ? [
          {
            name: "Loans Disbursed (Credit)",
            value: loanBook ?? 0,
          },
          {
            name: "Liquid & Statutory Reserves",
            value: Math.max(0, totalDeposits - (loanBook ?? 0)),
          },
        ].filter((d) => d.value > 0)
      : [];

  // Growth chart data from actual milestones
  const growthChartData = (yearWiseMetrics || [])
    .filter((m) => (m.deposits != null && m.deposits > 0) || (m.loans != null && m.loans > 0) || (m.netWorth != null && m.netWorth > 0))
    .map((m) => ({
      year: m.year,
      depositsCr: m.deposits ? Number((m.deposits / 1e7).toFixed(2)) : 0,
      loansCr: m.loans ? Number((m.loans / 1e7).toFixed(2)) : 0,
      netWorthCr: m.netWorth ? Number((m.netWorth / 1e7).toFixed(2)) : 0,
    }));

  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border border-ink-200 bg-white p-3 shadow-lg text-xs">
          <div className="font-semibold text-ink-900">{data.name}</div>
          <div className="mt-1 font-bold text-brand-600 text-sm">
            {inr(data.amount, { compact: true })} ({inr(data.amount)})
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
            {data.inCrores} Crore INR · Verified Official Fact
          </div>
        </div>
      );
    }
    return null;
  };

  const calculatedCdRatio =
    cdRatio != null
      ? cdRatio
      : totalDeposits && loanBook && totalDeposits > 0
      ? Math.round((loanBook / totalDeposits) * 100)
      : null;

  return (
    <div className="space-y-4">
      {/* Financial Status Banner & Tabs (Only when actual data exists) */}
      {hasActualFinancials ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50/70 border border-emerald-200 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-0.5 font-bold text-white shadow-2xs">
              <span>●</span>
              <span>Audited / Published Balance Sheet</span>
            </span>
            {financialYear && (
              <span className="rounded bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                FY {financialYear}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                activeTab === "overview"
                  ? "bg-white text-emerald-800 shadow-sm border border-emerald-300 font-semibold"
                  : "text-emerald-700 hover:text-emerald-900"
              }`}
            >
              Balance Sheet Graph
            </button>
            {distributionPieData.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab("distribution")}
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                  activeTab === "distribution"
                    ? "bg-white text-emerald-800 shadow-sm border border-emerald-300 font-semibold"
                    : "text-emerald-700 hover:text-emerald-900"
                }`}
              >
                Deposit vs Credit
              </button>
            )}
            {yearWiseMetrics && yearWiseMetrics.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab("growth")}
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                  activeTab === "growth"
                    ? "bg-white text-emerald-800 shadow-sm border border-emerald-300 font-semibold"
                    : "text-emerald-700 hover:text-emerald-900"
                }`}
              >
                Year-Wise Growth
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* Main Graph Area: Show graph ONLY if actual data is present, otherwise show Data Not Available */}
      {hasActualFinancials && barData.length > 0 ? (
        activeTab === "overview" ? (
          <div>
            <div className="mb-2 text-xs text-ink-500 flex justify-between">
              <span>Verified Financial Position & Scale (₹ Crores)</span>
              <span className="italic text-[11px] text-emerald-700 font-medium">All figures in ₹ Cr</span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#475569" }}
                    angle={-15}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#475569" }}
                    tickFormatter={(v) => `₹${v} Cr`}
                    width={60}
                  />
                  <Tooltip content={customTooltip} />
                  <Bar dataKey="inCrores" radius={[6, 6, 0, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : activeTab === "distribution" ? (
          <div>
            <div className="mb-2 text-xs text-ink-500">
              Deposit Utilization & Credit-to-Deposit Portfolio (₹ {inr(totalDeposits ?? 0, { compact: true })})
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionPieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {distributionPieData.map((_, index) => (
                      <Cell key={`cell-pie-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => inr(Number(val), { compact: true })} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-2 text-xs text-ink-500">
              Historical Milestones & Year-Wise Financial Growth
            </div>
            {growthChartData.length > 0 ? (
              <div className="h-60 w-full mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={growthChartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#475569" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#475569" }} tickFormatter={(v) => `₹${v} Cr`} width={60} />
                    <Tooltip formatter={(val: any) => `₹${val} Cr`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="depositsCr" name="Deposits (₹ Cr)" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="loansCr" name="Loans (₹ Cr)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="netWorthCr" name="Net Worth (₹ Cr)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
            <div className="space-y-2">
              {(yearWiseMetrics || []).map((m, idx) => (
                <div key={idx} className="flex items-start justify-between gap-3 rounded-lg border border-ink-100 bg-white p-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                      {m.year}
                    </span>
                    <span className="text-ink-700 font-medium">{m.milestone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-right shrink-0">
                    {m.deposits && <span className="text-brand-600 font-semibold">{inr(m.deposits, { compact: true })} Dep</span>}
                    {m.loans && <span className="text-cyan-700 font-semibold">{inr(m.loans, { compact: true })} Loans</span>}
                    {m.branches && <span className="text-violet-700 font-semibold">{m.branches} Br</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        /* Empty State: Shown when no actual data exists */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/60 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-500 mb-3">
            <BarChart3 size={24} className="text-ink-400" />
          </div>
          <h4 className="text-sm font-bold text-ink-900">Data Not Available</h4>
          <p className="mt-1 max-w-md text-xs text-ink-500 leading-relaxed">
            Actual balance sheet and financial figures have not been recorded or extracted for this institution yet.
          </p>
          <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 shadow-2xs">
            <AlertCircle size={13} className="text-amber-600 shrink-0" />
            <span>Click <b>“Generate AI insights”</b> above to extract real financial data from official website</span>
          </div>
        </div>
      )}

      {/* Financial Metrics Summary Strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
        <div className="rounded-lg border border-ink-100 bg-white p-2.5">
          <div className="text-[11px] font-medium text-ink-500">Total Members</div>
          <div className="mt-0.5 text-base font-bold text-ink-900 tabular-nums">
            {totalMembers != null && totalMembers > 0 ? num(totalMembers) : <span className="text-ink-400 text-xs font-normal">Not Available</span>}
          </div>
          <div className="text-[10px] text-ink-400">
            {totalMembers != null && totalMembers > 0 ? "Published Fact" : "Pending Extraction"}
          </div>
        </div>

        <div className="rounded-lg border border-ink-100 bg-white p-2.5">
          <div className="text-[11px] font-medium text-ink-500">Total Deposits</div>
          <div className="mt-0.5 text-base font-bold text-brand-600 tabular-nums">
            {totalDeposits != null && totalDeposits > 0 ? inr(totalDeposits, { compact: true }) : <span className="text-ink-400 text-xs font-normal">Not Available</span>}
          </div>
          <div className="text-[10px] text-ink-400">
            {totalDeposits != null && totalDeposits > 0 ? "Official Fact" : "Pending Extraction"}
          </div>
        </div>

        <div className="rounded-lg border border-ink-100 bg-white p-2.5">
          <div className="text-[11px] font-medium text-ink-500">Loan Book (Advances)</div>
          <div className="mt-0.5 text-base font-bold text-cyan-700 tabular-nums">
            {loanBook != null && loanBook > 0 ? inr(loanBook, { compact: true }) : <span className="text-ink-400 text-xs font-normal">Not Available</span>}
          </div>
          <div className="text-[10px] text-ink-400">
            {loanBook != null && loanBook > 0 ? "Official Fact" : "Pending Extraction"}
          </div>
        </div>

        <div className="rounded-lg border border-ink-100 bg-white p-2.5">
          <div className="text-[11px] font-medium text-ink-500">Own Funds (Net Worth)</div>
          <div className="mt-0.5 text-base font-bold text-emerald-700 tabular-nums">
            {netWorth != null && netWorth > 0 ? inr(netWorth, { compact: true }) : <span className="text-ink-400 text-xs font-normal">Not Available</span>}
          </div>
          <div className="text-[10px] text-ink-400">
            {netWorth != null && netWorth > 0 ? "Official Fact" : "Pending Extraction"}
          </div>
        </div>

        <div className="rounded-lg border border-ink-100 bg-white p-2.5">
          <div className="text-[11px] font-medium text-ink-500">Branch Network</div>
          <div className="mt-0.5 text-base font-bold text-violet-700 tabular-nums">
            {branchCount != null && branchCount > 0 ? `${branchCount} ${branchCount === 1 ? "Branch" : "Branches"}` : <span className="text-ink-400 text-xs font-normal">Not Available</span>}
          </div>
          <div className="text-[10px] text-ink-400">
            {branchCount != null && branchCount > 0 ? "Discovered" : "Pending Extraction"}
          </div>
        </div>

        <div className="rounded-lg border border-ink-100 bg-white p-2.5">
          <div className="text-[11px] font-medium text-ink-500">CD Ratio & Health</div>
          <div className="mt-0.5 text-sm font-bold text-indigo-700 tabular-nums">
            {calculatedCdRatio != null ? (
              `${calculatedCdRatio}% CD${crar != null ? ` · ${crar}% CRAR` : ""}`
            ) : (
              <span className="text-ink-400 text-xs font-normal">Not Available</span>
            )}
          </div>
          <div className="text-[10px] text-ink-400">
            {calculatedCdRatio != null ? "Credit Ratio" : "Pending Extraction"}
          </div>
        </div>
      </div>
    </div>
  );
}
