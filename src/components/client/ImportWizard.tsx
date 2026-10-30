"use client";
import Papa from "papaparse";
import { useState } from "react";

type O = { value: string; label: string };
const FIELDS: [string, string[]][] = [
  ["legalName", ["legal name", "legal_name", "name", "society name", "society_name", "name of society", "institution", "institution name"]],
  ["regNumber", ["reg number", "reg_number", "registration number", "registration no", "reg no", "regn no", "registration_no"]],
  ["type", ["type", "institution type", "category"]], ["taluka", ["taluka", "tehsil", "tahsil"]],
  ["address", ["address", "head office address", "office address"]], ["city", ["city", "town", "village", "city/town/village"]], ["pinCode", ["pin", "pincode", "pin code"]],
  ["landline", ["landline", "phone", "telephone", "office phone"]], ["mobile", ["mobile", "mobile number"]], ["email", ["email", "e-mail"]], ["website", ["website", "url"]],
  ["totalMembers", ["members", "total members", "member count"]], ["branchCount", ["branches", "branch count", "no of branches"]], ["totalDeposits", ["deposits", "total deposits"]],
  ["regAuthority", ["registration authority", "authority"]], ["sourceUrl", ["source url", "source_url"]], ["notes", ["notes", "remarks"]],
];

export function ImportWizard({ districts, types, owners }: { districts: O[]; types: O[]; owners: O[] }) {
  const [rows, setRows] = useState<Record<string, string>[]>([]); const [headers, setHeaders] = useState<string[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [cfg, setCfg] = useState({ districtId: districts[0]?.value ?? "", defaultTypeKey: "", sourceName: "", sourceUrl: "", accessedAt: new Date().toISOString().slice(0, 10), assignTo: "" });
  const [report, setReport] = useState<any>(null); const [busy, setBusy] = useState(false); const [progress, setProgress] = useState("");

  function onFile(f: File) {
    Papa.parse<Record<string, string>>(f, { header: true, skipEmptyLines: true, complete: (r) => {
      const hs = r.meta.fields ?? []; setHeaders(hs); setRows(r.data); setReport(null);
      const m: Record<string, string> = {};
      for (const [field, aliases] of FIELDS) { const h = hs.find((x) => aliases.includes(x.toLowerCase().trim())); if (h) m[field] = h; }
      setMap(m);
    } });
  }
  const mapped = () => rows.map((r) => Object.fromEntries(Object.entries(map).filter(([, h]) => h).map(([f, h]) => [f, r[h]])));

  async function run(mode: "preview" | "commit") {
    setBusy(true); setReport(null);
    const all = mapped(); const agg = { valid: 0, inserted: 0, duplicates: 0, errors: [] as any[], duplicateSample: [] as any[] };
    try {
      for (let k = 0; k < all.length; k += 1000) {
        setProgress(`${mode === "preview" ? "Checking" : "Importing"} rows ${k + 1}–${Math.min(k + 1000, all.length)} of ${all.length}…`);
        const res = await fetch("/api/leads/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
          mode, rows: all.slice(k, k + 1000), districtId: cfg.districtId, defaultTypeKey: cfg.defaultTypeKey || undefined, sourceName: cfg.sourceName,
          sourceUrl: cfg.sourceUrl || null, accessedAt: cfg.accessedAt, assignTo: cfg.assignTo || null }) });
        const j = await res.json();
        if (!res.ok) { setReport({ error: [j.error, ...(j.details ?? [])].join(" — ") }); return; }
        agg.valid += j.valid ?? 0; agg.inserted += j.inserted ?? 0; agg.duplicates += j.duplicates ?? 0;
        agg.errors.push(...(j.errors ?? []).map((e: any) => ({ ...e, row: e.row + k })));
        agg.duplicateSample.push(...(j.duplicateSample ?? []).map((e: any) => ({ ...e, row: e.row + k })));
      }
      setReport({ mode, ...agg });
    } finally { setBusy(false); setProgress(""); }
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="lbl">CSV file</label><input type="file" accept=".csv,text/csv" className="input" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></div>
          <div><label className="lbl">District</label><select className="input" value={cfg.districtId} onChange={(e) => setCfg({ ...cfg, districtId: e.target.value })}>{districts.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
          <div><label className="lbl">Default type (if no type column)</label><select className="input" value={cfg.defaultTypeKey} onChange={(e) => setCfg({ ...cfg, defaultTypeKey: e.target.value })}><option value="">—</option>{types.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
          <div><label className="lbl">Source name *</label><input className="input" placeholder="e.g. ARCS Pune society directory" value={cfg.sourceName} onChange={(e) => setCfg({ ...cfg, sourceName: e.target.value })} /></div>
          <div><label className="lbl">Source URL</label><input className="input" value={cfg.sourceUrl} onChange={(e) => setCfg({ ...cfg, sourceUrl: e.target.value })} /></div>
          <div><label className="lbl">Date accessed</label><input type="date" className="input" value={cfg.accessedAt} onChange={(e) => setCfg({ ...cfg, accessedAt: e.target.value })} /></div>
          {owners.length > 0 && <div><label className="lbl">Assign imported leads to</label><select className="input" value={cfg.assignTo} onChange={(e) => setCfg({ ...cfg, assignTo: e.target.value })}><option value="">Leave unassigned</option>{owners.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>}
        </div>
      </div>
      {headers.length > 0 && (
        <div className="card p-4">
          <h2 className="h2 mb-2">Map columns ({rows.length.toLocaleString("en-IN")} rows)</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {FIELDS.map(([f]) => (
              <div key={f}><label className="lbl">{f}{f === "legalName" && " *"}</label>
                <select className="input" value={map[f] ?? ""} onChange={(e) => setMap({ ...map, [f]: e.target.value })}><option value="">— not imported —</option>{headers.map((h) => <option key={h} value={h}>{h}</option>)}</select></div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-ghost" disabled={busy || !map.legalName || !cfg.sourceName} onClick={() => run("preview")}>1. Check (dry run)</button>
            <button className="btn-primary" disabled={busy || !report || report.mode !== "preview" || !report.valid} onClick={() => run("commit")}>2. Import {report?.mode === "preview" ? report.valid.toLocaleString("en-IN") : ""} rows</button>
            {progress && <span className="muted self-center">{progress}</span>}
          </div>
        </div>
      )}
      {report && (
        <div className="card p-4 text-sm">
          {report.error ? <p className="text-red-700">{report.error}</p> : (<>
            <p className="font-medium">{report.mode === "preview" ? `Ready to import ${report.valid} rows` : `Imported ${report.inserted} rows`} · {report.duplicates} duplicates skipped · {report.errors.length} warnings/errors</p>
            {report.errors.length > 0 && <ul className="mt-2 max-h-48 list-disc overflow-auto pl-5 text-xs text-red-700">{report.errors.slice(0, 200).map((e: any, k: number) => <li key={k}>Row {e.row}: {e.error}</li>)}</ul>}
            {report.duplicateSample.length > 0 && <ul className="mt-2 max-h-48 list-disc overflow-auto pl-5 text-xs text-ink-700">{report.duplicateSample.slice(0, 100).map((e: any, k: number) => <li key={k}>Row {e.row}: {e.legalName} — {e.reason}</li>)}</ul>}
            {report.mode === "commit" && <p className="mt-2"><a href="/leads?sort=recent" className="link">View imported leads →</a> Scoring for large imports runs in the background.</p>}
          </>)}
        </div>
      )}
    </div>
  );
}
