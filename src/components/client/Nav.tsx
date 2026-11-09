"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { Menu, X, Bell, LogOut } from "lucide-react";

export type NavItem = { href: string; label: string; group: string };

export function Nav({ items, user, unread }: { items: NavItem[]; user: { name: string; role: string; grant?: string | null }; unread: number }) {
  const path = usePathname(); const [open, setOpen] = useState(false);
  const groups = [...new Set(items.map((i) => i.group))];
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }
  const list = (
    <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
      {groups.map((g) => (
        <div key={g}>
          <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/50">{g}</div>
          {items.filter((i) => i.group === g).map((i) => (
            <Link key={i.href} href={i.href} onClick={() => setOpen(false)}
              className={clsx("block rounded-md px-2 py-1.5 text-sm", path === i.href || (i.href !== "/" && path.startsWith(i.href + "/")) ? "bg-white/15 font-medium text-white" : "text-white/80 hover:bg-white/10")}>{i.label}</Link>
          ))}
        </div>
      ))}
    </nav>
  );
  const brand = (
    <Link href="/" className="flex items-center gap-2.5 px-4 py-4 transition hover:opacity-95">
      <div className="flex h-10 w-11 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-sm">
        <img
          src="/manalix_logo.svg"
          alt="Manalix Technologies"
          className="h-8 w-auto max-w-full object-contain"
        />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold text-white tracking-tight truncate">Fivopay CRM</div>
        <div className="text-[10px] font-medium text-white/70 truncate">Manalix Technologies</div>
      </div>
    </Link>
  );
  const foot = (
    <div className="border-t border-white/10 p-3 text-white">
      {user.grant && <div className="mb-2 rounded bg-amber-400/20 px-2 py-1 text-[11px] text-amber-100">Data-access grant active until {user.grant}</div>}
      <div className="text-sm font-medium">{user.name}</div><div className="text-[11px] text-white/60">{user.role}</div>
      <div className="mt-2 flex gap-2">
        <Link href="/notifications" className="relative rounded-md bg-white/10 p-1.5 hover:bg-white/20" aria-label="Notifications"><Bell size={16} />{unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1 text-[10px]">{unread}</span>}</Link>
        <button onClick={logout} className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1.5 text-xs hover:bg-white/20"><LogOut size={14} />Sign out</button>
      </div>
    </div>
  );
  return (<>
    <aside className="brand-gradient fixed inset-y-0 left-0 z-30 hidden w-60 flex-col lg:flex">{brand}{list}{foot}</aside>
    <header className="brand-gradient sticky top-0 z-30 flex items-center justify-between px-3 py-2 lg:hidden">
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen(true)} className="rounded p-1.5 text-white" aria-label="Open menu"><Menu /></button>
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-8 shrink-0 items-center justify-center rounded-lg bg-white p-0.5 shadow-2xs">
            <img src="/manalix_logo.svg" alt="Manalix" className="h-6 w-auto object-contain" />
          </div>
          <span className="text-sm font-bold text-white">Fivopay CRM</span>
        </Link>
      </div>
      <Link href="/notifications" className="relative p-1.5 text-white"><Bell size={20} />{unread > 0 && <span className="absolute right-0 top-0 rounded-full bg-red-500 px-1 text-[10px]">{unread}</span>}</Link>
    </header>
    {open && (
      <div className="fixed inset-0 z-40 lg:hidden">
        <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
        <aside className="brand-gradient absolute inset-y-0 left-0 flex w-72 flex-col">
          <div className="flex items-center justify-between pr-2">{brand}<button onClick={() => setOpen(false)} className="p-2 text-white"><X /></button></div>{list}{foot}
        </aside>
      </div>
    )}
  </>);
}
