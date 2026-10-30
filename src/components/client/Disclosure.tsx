"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
export function Disclosure({ label, children, open: initial = false }: { label: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(initial);
  return (
    <div className="mt-3">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1 text-sm font-medium text-brand-600"><ChevronDown size={16} className={open ? "rotate-180 transition" : "transition"} />{label}</button>
      {open && <div className="mt-2 rounded-lg border border-ink-100 bg-ink-50/50 p-3">{children}</div>}
    </div>
  );
}
