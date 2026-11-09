"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export function GlobalLoadingIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeRequests, setActiveRequests] = useState(0);
  const [navigating, setNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showBadge, setShowBadge] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isLoading = activeRequests > 0 || navigating;

  // Intercept all native fetch calls globally
  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      // Don't track background polling or silent heartbeats if any
      const url = typeof args[0] === "string" ? args[0] : args[0] instanceof URL ? args[0].toString() : (args[0] as Request).url;
      const isSilent = url.includes("/api/notifications/unread-count");

      if (!isSilent) {
        setActiveRequests((prev) => prev + 1);
      }

      try {
        return await originalFetch(...args);
      } finally {
        if (!isSilent) {
          setActiveRequests((prev) => Math.max(0, prev - 1));
        }
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Intercept internal link clicks for immediate feedback on page transition
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href) return;

      // Ignore anchor links, external links, download links, new tabs
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        target.target === "_blank" ||
        target.hasAttribute("download") ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey
      ) {
        return;
      }

      if (href.startsWith("/") && href !== pathname) {
        setNavigating(true);
      }
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
    };
  }, [pathname]);

  // Reset navigation loading when route changes
  useEffect(() => {
    setNavigating(false);
  }, [pathname, searchParams]);

  // Manage progress bar animation & badge delay
  useEffect(() => {
    if (isLoading) {
      // Show badge after 200ms to avoid flashing on instant clicks
      timerRef.current = setTimeout(() => {
        setShowBadge(true);
      }, 200);

      // Start progress animation
      setProgress((p) => (p < 20 ? 25 : p));
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
      animIntervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 85) return prev; // stall at 85% until finished
          return prev + Math.floor(Math.random() * 12 + 4);
        });
      }, 250);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);

      setProgress(100);
      const finishTimeout = setTimeout(() => {
        setProgress(0);
        setShowBadge(false);
      }, 350);

      return () => clearTimeout(finishTimeout);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    };
  }, [isLoading]);

  if (progress === 0 && !showBadge) return null;

  return (
    <>
      {/* Top indeterminate progress bar */}
      {progress > 0 && (
        <div
          className="fixed top-0 left-0 right-0 z-[99999] h-[3px] pointer-events-none bg-transparent"
          role="progressbar"
          aria-valuenow={progress}
        >
          <div
            className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-600 shadow-[0_0_8px_rgba(6,182,212,0.6)] transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              opacity: progress === 100 ? 0 : 1,
              transition: progress === 100 ? "all 300ms ease-out" : "width 250ms ease",
            }}
          />
        </div>
      )}

      {/* Modern floating top-right action badge */}
      {showBadge && (
        <div className="fixed top-3 right-4 z-[99998] flex items-center gap-2 rounded-full border border-sky-200/80 bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-800 shadow-md backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-top-2">
          <Loader2 size={13} className="animate-spin text-brand-600" />
          <span>{navigating ? "Loading page..." : "Processing request..."}</span>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
          </span>
        </div>
      )}
    </>
  );
}

