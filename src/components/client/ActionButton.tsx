"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** One-click API action (approve, delete, rescore…) with optional confirm/prompt. */
export function ActionButton({ url, method = "POST", body, label, busyLabel, confirm, prompt, promptKey = "note", className = "btn-ghost", redirectTo, download }: {
  url: string; method?: string; body?: Record<string, any>; label: string; busyLabel?: string; confirm?: string; prompt?: string; promptKey?: string;
  className?: string; redirectTo?: string; download?: boolean;
}) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function go() {
    if (confirm && !window.confirm(confirm)) return;
    let b = body ?? {};
    if (prompt) { const v = window.prompt(prompt); if (v == null) return; b = { ...b, [promptKey]: v }; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(b) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(j.error ?? `Error ${res.status}`); return; }
      if (redirectTo) router.push(redirectTo.replace("{id}", j.id ?? "")); else router.refresh();
    } finally { setBusy(false); }
  }
  return <span className="inline-flex flex-col"><button type="button" className={className} disabled={busy} onClick={go}>{busy ? (busyLabel ?? "…") : label}</button>{err && <span className="mt-1 max-w-xs text-xs text-red-600">{err}</span>}</span>;
}
