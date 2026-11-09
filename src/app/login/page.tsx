"use client";
import { useState } from "react";
export default function Login() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    const j = await res.json().catch(() => ({})); setBusy(false);
    if (!res.ok) return setErr(j.error ?? "Sign-in failed");
    window.location.href = j.mustChangePassword ? "/change-password" : "/";
  }
  return (
    <div className="brand-gradient grid min-h-screen place-items-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6 shadow-xl">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-14 w-auto items-center justify-center rounded-2xl bg-white p-2 shadow-md border border-ink-100">
            <img src="/manalix_logo.svg" alt="Manalix Technologies" className="h-10 w-auto object-contain" />
          </div>
          <div>
            <div className="text-lg font-bold text-ink-950">Fivopay Intelligence & Sales CRM</div>
            <div className="text-xs text-ink-500">Manalix Technologies — Authorised Users Only</div>
          </div>
        </div>
        <div><label className="lbl">Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus autoComplete="username" /></div>
        <div><label className="lbl">Password</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></div>
        {err && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
