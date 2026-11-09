"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, CheckCircle2, AlertCircle, Search, Building2, Users, TrendingUp, X } from "lucide-react";

interface GenerateAiInsightsButtonProps {
  institutionId: string;
  legalName?: string;
}

const STEPS = [
  {
    icon: Search,
    title: "Searching official website & cooperative records...",
    sub: "Querying Google Search Grounding with Gemini 2.5 Flash",
    targetProgress: 25,
  },
  {
    icon: Building2,
    title: "Extracting branches, contact channels & financial metrics...",
    sub: "Detecting official email, phone, branch locations, and deposits",
    targetProgress: 55,
  },
  {
    icon: Users,
    title: "Identifying key management & decision makers...",
    sub: "Mapping Chairman, General Manager & branch leadership",
    targetProgress: 80,
  },
  {
    icon: TrendingUp,
    title: "Computing Fivopay pricing & opportunity strategy...",
    sub: "Re-scoring lead and generating B2B sales recommendations",
    targetProgress: 95,
  },
];

export function GenerateAiInsightsButton({ institutionId, legalName }: GenerateAiInsightsButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Animate steps and progress while busy
  useEffect(() => {
    if (!busy) return;

    setProgress(10);
    setStepIdx(0);

    const stepInterval = setInterval(() => {
      setStepIdx((prev) => {
        const next = prev + 1;
        if (next < STEPS.length) {
          setProgress(STEPS[next].targetProgress);
          return next;
        }
        return prev;
      });
    }, 2400);

    // Smooth progress ticker
    const progressInterval = setInterval(() => {
      setProgress((p) => {
        if (p >= 92) return p;
        return p + 1;
      });
    }, 150);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, [busy]);

  async function handleGenerate() {
    setBusy(true);
    setErr(null);
    setSuccess(false);
    setProgress(5);

    try {
      const res = await fetch(`/api/leads/${institutionId}/insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }

      setProgress(100);
      setSuccess(true);

      // Brief delay so user sees 100% completed
      setTimeout(() => {
        router.refresh();
        setBusy(false);
        setSuccess(false);
      }, 700);
    } catch (e: any) {
      setErr(e.message || "Failed to generate AI insights");
      setBusy(false);
    }
  }

  const currentStep = STEPS[stepIdx] || STEPS[0];
  const StepIcon = currentStep.icon;

  return (
    <>
      {/* ── The Main Button ── */}
      <button
        type="button"
        disabled={busy}
        onClick={handleGenerate}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition shadow-xs ${
          busy
            ? "cursor-not-allowed bg-violet-100 text-violet-800 border border-violet-300"
            : "bg-white text-ink-800 border border-ink-200 hover:bg-violet-50 hover:text-violet-900 hover:border-violet-300 active:scale-98"
        }`}
      >
        {busy ? (
          <>
            <Loader2 size={13} className="animate-spin text-violet-600" />
            <span className="font-semibold text-violet-800">Researching & Extracting…</span>
          </>
        ) : (
          <>
            <Sparkles size={13} className="text-violet-600" />
            <span>Generate AI insights</span>
          </>
        )}
      </button>

      {/* ── Top Floating / Sticky Loading Modal Bar (Active during extraction) ── */}
      {busy && (
        <div className="fixed inset-x-0 top-0 z-50 flex justify-center p-3 sm:p-4 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-violet-200 bg-white/95 p-4 shadow-2xl backdrop-blur-md">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white shadow-xs">
                  {success ? (
                    <CheckCircle2 size={18} className="text-white" />
                  ) : (
                    <Sparkles size={16} className="animate-pulse text-violet-200" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-ink-900 flex items-center gap-1.5">
                    <span>
                      {success
                        ? "Extraction Complete!"
                        : "Gemini 2.5 Flash Web Research Engine"}
                    </span>
                    <span className="rounded-full bg-violet-100 px-2 py-0.2 text-[10px] font-semibold text-violet-800">
                      LIVE
                    </span>
                  </h4>
                  <p className="text-[11px] text-ink-500 truncate max-w-xs sm:max-w-md">
                    {legalName ? `${legalName}` : "Analyzing cooperative society..."}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-sm font-bold text-violet-700 tabular-nums">
                  {progress}%
                </span>
              </div>
            </div>

            {/* The Loading Progress Bar */}
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-violet-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-brand-500 transition-all duration-300 ease-out shadow-xs"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Dynamic Step Text */}
            <div className="mt-2.5 flex items-start gap-2 text-xs">
              <div className="mt-0.5 text-violet-600 shrink-0">
                {success ? (
                  <CheckCircle2 size={14} className="text-emerald-600" />
                ) : (
                  <StepIcon size={14} className="animate-bounce" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink-800">
                  {success ? "All real website facts & insights loaded!" : currentStep.title}
                </div>
                <div className="text-[11px] text-ink-500">
                  {success ? "Refreshing lead profile page..." : currentStep.sub}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Error Toast (if any) ── */}
      {err && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 shadow-xl animate-in fade-in slide-in-from-bottom-2">
          <AlertCircle size={16} className="text-red-600 shrink-0" />
          <div className="font-medium">{err}</div>
          <button
            type="button"
            onClick={() => setErr(null)}
            className="ml-2 rounded p-1 hover:bg-red-100 text-red-600"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </>
  );
}

