import { Loader2 } from "lucide-react";

export default function RootLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50/50 p-4">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl max-w-sm w-full text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 via-sky-500 to-indigo-600 text-white shadow-md shadow-brand-500/20">
          <Loader2 size={28} className="animate-spin" />
        </div>
        <h2 className="text-base font-bold text-ink-900 mt-2">Loading Fivopay CRM</h2>
        <p className="text-xs text-ink-500">Preparing your session and commercial data...</p>
        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
          <div className="bg-brand-600 h-full rounded-full w-2/3 animate-[pulse_1s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
}

