"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";

type Stage = { id: string; key: string; name: string; isOpen: boolean; isWon: boolean; isLost: boolean; stallDays: number; probability: number };
type Deal = { id: string; title: string; stageId: string; mrr: number; followUpDate: string | null; nextAction: string | null; founderFlag: boolean; stageChangedAt: string; owner: string; institution: string; band: string; score: number };

const BAND: Record<string, string> = { HOT: "bg-red-500", WARM: "bg-amber-500", NURTURE: "bg-sky-500", LOW: "bg-ink-300" };

export function Kanban({ stages, deals, canMove }: { stages: Stage[]; deals: Deal[]; canMove: boolean }) {
  const router = useRouter(); const [drag, setDrag] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null); const [showClosed, setShowClosed] = useState(false);
  const cols = stages.filter((s) => s.isOpen || showClosed);
  async function move(dealId: string, stageId: string) {
    setErr(null);
    const st = stages.find((s) => s.id === stageId)!;
    if (st.isLost) { setErr("Mark deals lost from the deal page (a lost reason is required)."); return; }
    const res = await fetch(`/api/deals/${dealId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ stageId }) });
    if (!res.ok) setErr((await res.json()).error); else router.refresh();
  }
  const now = Date.now();
  return (<>
    <div className="mb-2 flex items-center gap-3 text-sm"><label className="flex items-center gap-1"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />Show won / lost / on hold</label>
      {err && <span className="text-red-600">{err}</span>}</div>
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
      {cols.map((s) => {
        const items = deals.filter((d) => d.stageId === s.id);
        return (
          <div key={s.id} className="w-64 shrink-0 rounded-xl bg-ink-100 p-2" onDragOver={(e) => canMove && e.preventDefault()} onDrop={() => { if (drag) move(drag, s.id); setDrag(null); }}>
            <div className="mb-2 px-1"><div className="text-xs font-semibold uppercase text-ink-700">{s.name}</div>
              <div className="text-[11px] text-ink-500">{items.length} · ₹{Math.round(items.reduce((a, d) => a + d.mrr, 0)).toLocaleString("en-IN")} MRR · {s.probability}%</div></div>
            <div className="space-y-2">
              {items.map((d) => {
                const overdue = d.followUpDate && new Date(d.followUpDate).getTime() < now;
                const stalled = s.isOpen && now - new Date(d.stageChangedAt).getTime() > s.stallDays * 864e5;
                return (
                  <div key={d.id} draggable={canMove} onDragStart={() => setDrag(d.id)} className={clsx("rounded-lg border bg-white p-2 text-xs shadow-sm", canMove && "cursor-grab", overdue ? "border-red-300" : "border-ink-100")}>
                    <div className="flex items-start gap-1.5"><span className={clsx("mt-1 h-2 w-2 shrink-0 rounded-full", BAND[d.band])} title={`${d.band} ${d.score}`} />
                      <Link href={`/deals/${d.id}`} className="font-medium text-ink-900 hover:text-brand-600">{d.institution}</Link></div>
                    <div className="mt-1 text-ink-500">{d.owner} · ₹{Math.round(d.mrr).toLocaleString("en-IN")}/mo</div>
                    {d.nextAction && <div className="mt-1 text-ink-700">→ {d.nextAction}</div>}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {d.followUpDate && <span className={clsx("rounded px-1", overdue ? "bg-red-100 text-red-700" : "bg-ink-100")}>{new Date(d.followUpDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>}
                      {stalled && <span className="rounded bg-amber-100 px-1 text-amber-800">stalled</span>}
                      {d.founderFlag && <span className="rounded bg-violet-100 px-1 text-violet-800">founder</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  </>);
}
