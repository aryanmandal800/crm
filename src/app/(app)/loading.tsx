import { Loader2 } from "lucide-react";

export default function AppLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header bar loading state */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-ink-100 pb-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-48 animate-pulse rounded-md bg-slate-200" />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
              <Loader2 size={12} className="animate-spin text-brand-600" />
              Loading workspace...
            </span>
          </div>
          <div className="h-3.5 w-72 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-9 w-28 animate-pulse rounded-lg bg-brand-100" />
        </div>
      </div>

      {/* 4 Stat Skeleton Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-20 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-4 animate-pulse rounded-full bg-slate-200" />
            </div>
            <div className="h-7 w-28 animate-pulse rounded-md bg-slate-200" />
            <div className="h-3 w-36 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>

      {/* Main Content / Table Skeleton */}
      <div className="card overflow-hidden">
        <div className="border-b border-ink-100 bg-slate-50/60 px-5 py-3.5 flex items-center justify-between">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="divide-y divide-ink-100 p-2">
          {[1, 2, 3, 4, 5, 6].map((row) => (
            <div key={row} className="flex items-center justify-between px-4 py-3.5 space-x-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-slate-200" />
                <div className="space-y-1.5 flex-1 max-w-sm">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
              <div className="hidden sm:block h-5 w-24 animate-pulse rounded-full bg-slate-100" />
              <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
              <div className="h-7 w-16 animate-pulse rounded-md bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

