"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";

export type FieldDef = {
  name: string; label: string; type?: "text" | "number" | "textarea" | "select" | "checkbox" | "date" | "datetime" | "email" | "password" | "multiselect" | "tags" | "hidden" | "json";
  options?: { value: string; label: string }[]; required?: boolean; help?: string; placeholder?: string; wide?: boolean; step?: string;
};

function toInput(v: any, type?: string) {
  if (v == null) return "";
  if (type === "date") return String(v).slice(0, 10);
  if (type === "datetime") { const d = new Date(v); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
  if (type === "tags") return Array.isArray(v) ? v.join(", ") : v;
  if (type === "json") return typeof v === "string" ? v : JSON.stringify(v, null, 2);
  return v;
}

/** Generic JSON form → API route. Server validates everything again; this is UX only. */
export function JsonForm({ action, method = "POST", fields, initial = {}, submitLabel = "Save", redirectTo, extra, cols = 2, confirm: confirmMsg, onDoneMessage }: {
  action: string; method?: string; fields: FieldDef[]; initial?: Record<string, any>; submitLabel?: string; redirectTo?: string;
  extra?: Record<string, any>; cols?: 1 | 2 | 3; confirm?: string; onDoneMessage?: string;
}) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, any>>(() => Object.fromEntries(fields.map((f) => [f.name, f.type === "checkbox" ? !!initial[f.name] : f.type === "multiselect" ? initial[f.name] ?? [] : toInput(initial[f.name], f.type)])));
  const [dups, setDups] = useState<any>(null); const [force, setForce] = useState(false);
  const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setVals((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true); setErr(null); setMsg(null);
    const body: Record<string, any> = { ...extra, ...(force ? { force: true } : {}) };
    for (const f of fields) {
      let v = vals[f.name];
      if (f.type === "number") v = v === "" ? null : Number(v);
      else if (f.type === "date" || f.type === "datetime") v = v ? new Date(v).toISOString() : null;
      else if (f.type === "tags") v = String(v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
      else if (f.type === "json") { try { v = v ? JSON.parse(v) : null; } catch { setErr(`${f.label}: invalid JSON`); setBusy(false); return; } }
      else if (f.type === "select" && v === "") v = null;
      else if (typeof v === "string" && f.type !== "password") v = v.trim() === "" ? null : v;
      body[f.name] = v;
    }
    try {
      const res = await fetch(action, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErr([j.error, ...(j.details && Array.isArray(j.details) ? j.details : [])].filter(Boolean).join(" — ") || `Error ${res.status}`); return; }
      if (j.needsConfirm) { setDups(j.duplicates); setForce(true); return; }
      if (j.message || onDoneMessage) setMsg(j.message ?? onDoneMessage);
      if (redirectTo) router.push(redirectTo.replace("{id}", j.id ?? "")); else router.refresh();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className={clsx("grid gap-3", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-2 lg:grid-cols-3")}>
        {fields.filter((f) => f.type !== "hidden").map((f) => (
          <div key={f.name} className={clsx((f.wide || f.type === "textarea" || f.type === "json") && "sm:col-span-full")}>
            {f.type === "checkbox" ? (
              <label className="flex items-center gap-2 pt-5 text-sm"><input type="checkbox" checked={!!vals[f.name]} onChange={(e) => set(f.name, e.target.checked)} />{f.label}</label>
            ) : (<>
              <label className="lbl">{f.label}{f.required && " *"}</label>
              {f.type === "textarea" || f.type === "json" ? (
                <textarea className={clsx("input min-h-[90px]", f.type === "json" && "font-mono text-xs")} value={vals[f.name]} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} required={f.required} />
              ) : f.type === "select" ? (
                <select className="input" value={vals[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} required={f.required}>
                  {!f.required && <option value="">—</option>}
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === "multiselect" ? (
                <div className="flex flex-wrap gap-1.5 rounded-lg border border-ink-300 bg-white p-2">
                  {f.options?.map((o) => {
                    const on = (vals[f.name] as string[]).includes(o.value);
                    return <button type="button" key={o.value} onClick={() => set(f.name, on ? vals[f.name].filter((x: string) => x !== o.value) : [...vals[f.name], o.value])}
                      className={clsx("rounded-full border px-2 py-0.5 text-xs", on ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-300 text-ink-500")}>{o.label}</button>;
                  })}
                </div>
              ) : (
                <input className="input" type={f.type === "datetime" ? "datetime-local" : f.type ?? "text"} step={f.step ?? (f.type === "number" ? "any" : undefined)}
                  value={vals[f.name]} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} required={f.required} autoComplete={f.type === "password" ? "new-password" : undefined} />
              )}
            </>)}
            {f.help && <p className="mt-1 text-xs text-ink-500">{f.help}</p>}
          </div>
        ))}
      </div>
      {err && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      {dups && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-900">Possible duplicates found — check before saving:</p>
          <ul className="mt-1 list-disc pl-5">{[...dups.exact, ...dups.fuzzy].map((d: any) => <li key={d.id}><a className="link" href={`/leads/${d.id}`} target="_blank">{d.legalName}</a> ({d.leadCode}){d.similarity ? ` — ${Math.round(d.similarity * 100)}% similar` : " — exact match"}</li>)}</ul>
          <p className="mt-1 text-amber-900">Press save again to create it anyway.</p>
        </div>
      )}
      {msg && <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{msg}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : submitLabel}</button>
    </form>
  );
}
