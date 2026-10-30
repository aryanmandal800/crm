import Link from "next/link";
import clsx from "clsx";
import { NV, label } from "@/lib/format";

export function PageHeader({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="h1">{title}</h1>{sub && <p className="muted mt-1">{sub}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("card p-4", className)}>
      {(title || actions) && <div className="mb-3 flex items-center justify-between gap-2"><h2 className="h2">{title}</h2>{actions}</div>}
      {children}
    </section>
  );
}

export function Stat({ label: l, value, sub, href, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; href?: string; tone?: "hot" | "warm" | "good" | "bad" }) {
  const body = (
    <div className={clsx("card h-full p-3 transition", href && "hover:border-brand-400 hover:shadow")}>
      <div className="text-xs font-medium text-ink-500">{l}</div>
      <div className={clsx("mt-1 text-xl font-semibold sm:text-2xl", tone === "hot" && "text-red-600", tone === "warm" && "text-amber-600", tone === "good" && "text-emerald-600", tone === "bad" && "text-red-600")}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-500">{sub}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

const BAND: Record<string, string> = { HOT: "bg-red-100 text-red-700", WARM: "bg-amber-100 text-amber-800", NURTURE: "bg-sky-100 text-sky-800", LOW: "bg-ink-100 text-ink-700" };
export function BandBadge({ band, score }: { band: string; score?: number }) {
  return <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", BAND[band] ?? BAND.LOW)}>{band === "LOW" ? "LOW PRIORITY" : band}{score != null && ` · ${score}`}</span>;
}

const TONE: Record<string, string> = {
  VERIFIED: "bg-emerald-100 text-emerald-800", VERIFIED_FACT: "bg-emerald-100 text-emerald-800", PARTIAL: "bg-amber-100 text-amber-800",
  PUBLICLY_REPORTED: "bg-sky-100 text-sky-800", ESTIMATE: "bg-violet-100 text-violet-800", UNVERIFIED: "bg-ink-100 text-ink-700",
  DISPUTED: "bg-red-100 text-red-700", HIGH: "bg-emerald-100 text-emerald-800", MEDIUM: "bg-amber-100 text-amber-800", LOW: "bg-ink-100 text-ink-700",
  PENDING: "bg-amber-100 text-amber-800", APPROVED: "bg-emerald-100 text-emerald-800", REJECTED: "bg-red-100 text-red-700",
  DRAFT: "bg-ink-100 text-ink-700", PENDING_APPROVAL: "bg-amber-100 text-amber-800", SENT: "bg-sky-100 text-sky-800", ACCEPTED: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-emerald-100 text-emerald-800", IN_PROGRESS: "bg-sky-100 text-sky-800", DONE: "bg-emerald-100 text-emerald-800", FAILED: "bg-red-100 text-red-700",
  SUCCESS: "bg-emerald-100 text-emerald-800", RUNNING: "bg-sky-100 text-sky-800", QUEUED: "bg-ink-100 text-ink-700", AI: "bg-violet-100 text-violet-800",
  YES: "bg-emerald-100 text-emerald-800", NO: "bg-red-100 text-red-700", UNKNOWN: "bg-ink-100 text-ink-500",
};
export function Badge({ v, children }: { v: string; children?: React.ReactNode }) {
  return <span className={clsx("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", TONE[v] ?? "bg-ink-100 text-ink-700")}>{children ?? label(v)}</span>;
}

/** Shows a researched value, or "Not publicly verified", with its fact classification. */
export function Fact({ k, v, status, href }: { k: string; v: React.ReactNode; status?: string; href?: boolean }) {
  const empty = v == null || v === "" || v === "UNKNOWN";
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-500">{k}</dt>
      <dd className="mt-0.5 flex flex-wrap items-center gap-1.5 break-words text-sm">
        {empty ? <span className="italic text-ink-500">{NV}</span> : href && typeof v === "string" ? <a className="link break-all" href={v} target="_blank" rel="noreferrer">{v}</a> : v}
        {!empty && status && <Badge v={status} />}
      </dd>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-ink-300 p-6 text-center text-sm text-ink-500">{children}</div>;
}

export function Table({ head, children, empty }: { head: React.ReactNode[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="min-w-full divide-y divide-ink-100">
        <thead className="bg-ink-50"><tr>{head.map((h, i) => <th key={i} className="th">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-ink-100">{children}</tbody>
      </table>
      {empty && <div className="p-6 text-center text-sm text-ink-500">Nothing here yet.</div>}
    </div>
  );
}

export function AiBox({ children, source }: { children: React.ReactNode; source?: string | null }) {
  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-violet-700"><Badge v="AI">AI recommendation</Badge>{source && <span className="font-normal text-violet-600">{source}</span>}</div>
      {children}
    </div>
  );
}
