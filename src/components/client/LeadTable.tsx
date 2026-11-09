"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BandBadge, Badge } from "@/components/ui";

type Row = {
  id: string;
  leadCode: string;
  legalName: string;
  city: string | null;
  type: string;
  taluka: string | null;
  owner: string | null;
  score: number;
  band: string;
  members: number | null;
  branches: number | null;
  verification: string;
  category: string;
  vendor: string | null;
  createdAt?: Date | string | null;
};

export function LeadTable({
  rows,
  canAssign,
  assignees,
  startIndex = 0
}: {
  rows: Row[];
  canAssign: boolean;
  assignees: { value: string; label: string }[];
  startIndex?: number;
}) {
  const [sel, setSel] = useState<string[]>([]);
  const [owner, setOwner] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function assign() {
    const res = await fetch("/api/leads/assign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: sel, ownerId: owner || null }) });
    const j = await res.json(); setMsg(res.ok ? j.message : j.error); if (res.ok) { setSel([]); router.refresh(); }
  }

  const isRecent = (dt?: Date | string | null) => {
    if (!dt) return false;
    const t = new Date(dt).getTime();
    return Date.now() - t < 24 * 60 * 60 * 1000;
  };

  return (
    <div className="card overflow-hidden">
      {canAssign && sel.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 bg-brand-50 p-2 text-sm">
          <span className="font-medium">{sel.length} selected</span>
          <select className="input w-auto" value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">Unassign</option>{assignees.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select>
          <button className="btn-primary" onClick={assign}>Assign</button>{msg && <span className="text-ink-500">{msg}</span>}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-ink-100">
          <thead className="bg-ink-50">
            <tr>
              {canAssign && <th className="th w-8"><input type="checkbox" checked={sel.length === rows.length && rows.length > 0} onChange={(e) => setSel(e.target.checked ? rows.map((r) => r.id) : [])} /></th>}
              <th className="th w-12 text-center">#</th>
              <th className="th">Institution</th>
              <th className="th">Score</th>
              <th className="th hidden md:table-cell">Taluka</th>
              <th className="th hidden lg:table-cell">Type</th>
              <th className="th hidden md:table-cell">Members / branches</th>
              <th className="th hidden lg:table-cell">Opportunity</th>
              <th className="th hidden sm:table-cell">Owner</th>
              <th className="th hidden xl:table-cell">Verified</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r, idx) => {
              const sl = startIndex + idx + 1;
              return (
                <tr key={r.id} className="hover:bg-ink-50">
                  {canAssign && <td className="td"><input type="checkbox" checked={sel.includes(r.id)} onChange={() => toggle(r.id)} /></td>}
                  <td className="td text-center font-mono text-xs font-semibold text-ink-500">
                    {sl}
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/leads/${r.id}`} className="font-medium text-ink-900 hover:text-brand-600">
                        {r.legalName}
                      </Link>
                      {isRecent(r.createdAt) && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-800">
                          New
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-500">
                      {r.leadCode}{r.city ? ` · ${r.city}` : ""}
                    </div>
                  </td>
                  <td className="td"><BandBadge band={r.band} score={r.score} /></td>
                  <td className="td hidden md:table-cell">{r.taluka ?? "—"}</td>
                  <td className="td hidden text-xs lg:table-cell">{r.type}</td>
                  <td className="td hidden md:table-cell">{r.members?.toLocaleString("en-IN") ?? "—"} / {r.branches ?? "—"}</td>
                  <td className="td hidden text-xs lg:table-cell">{r.category.replace(/_/g, " ").toLowerCase()}</td>
                  <td className="td hidden sm:table-cell">{r.owner ?? <span className="text-ink-500">Unassigned</span>}</td>
                  <td className="td hidden xl:table-cell"><Badge v={r.verification} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <div className="p-8 text-center text-sm text-ink-500">No institutions match. Add one or run a bulk import.</div>}
      </div>
    </div>
  );
}
