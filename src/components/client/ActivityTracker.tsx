"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function getRouteTitle(pathname: string): string {
  if (pathname === "/" || pathname === "/dashboard") return "Viewing Analytics Dashboard";
  if (pathname === "/command-centre") return "Viewing Founder's Command Centre";
  if (pathname === "/my-day") return "Viewing My Day Activities";
  if (pathname === "/work-tracker") return "Viewing Work Tracker & Daily EOD";
  if (pathname === "/pipeline") return "Viewing Deal Pipeline";
  if (pathname === "/tasks") return "Viewing Team Tasks";
  if (pathname === "/activities") return "Viewing Activity Log";
  if (pathname === "/decision-makers") return "Viewing Decision Makers Registry";
  if (pathname === "/quotes") return "Viewing Quotes & Commercial Proposals";
  if (pathname === "/quotes/new") return "Creating New Commercial Proposal";
  if (pathname.startsWith("/quotes/")) return "Viewing Commercial Quotation Details";
  if (pathname === "/approvals") return "Viewing Pricing & Change Approvals";
  if (pathname === "/lost-deals") return "Viewing Lost Deals & Objections";
  if (pathname === "/onboarding") return "Viewing Customer Onboarding";
  if (pathname.startsWith("/onboarding/")) return "Viewing Customer Onboarding Details";
  if (pathname === "/competitors") return "Viewing Competitor Intelligence";
  if (pathname.startsWith("/competitors/")) return "Viewing Competitor Profile";
  if (pathname === "/society-finder") return "Searching Societies in Maharashtra Registry";
  if (pathname === "/sources") return "Viewing Research Sources & Citations";
  if (pathname === "/catalogue") return "Viewing CBS Catalogue & Pricing Slabs";
  if (pathname === "/performance") return "Viewing Sales Performance & KPIs";
  if (pathname === "/reports") return "Viewing Reports & Data Exports";
  if (pathname === "/change-requests") return "Viewing Change Requests";
  if (pathname.startsWith("/change-requests/")) return "Reviewing Change Request Details";
  if (pathname === "/tech") return "Viewing Technical Health Dashboard";
  if (pathname === "/admin/settings") return "Viewing System Settings & Rules";
  if (pathname === "/admin/users") return "Managing Users & Teams";
  if (pathname === "/admin/roles") return "Viewing Roles & Permissions";
  if (pathname === "/admin/grants") return "Viewing Break-Glass Data Grants";
  if (pathname === "/admin/audit") return "Viewing Audit Log";
  if (pathname === "/admin/staff-monitor") return "Viewing Staff Activity & Login Monitor";
  if (pathname === "/notifications") return "Viewing Notifications";
  if (pathname === "/leads") return "Browsing Credit Society Database";
  if (pathname === "/leads/new") return "Adding New Society / Lead";
  if (pathname === "/leads/import") return "Bulk Importing Leads";
  if (pathname.startsWith("/leads/")) return "Inspecting Lead Details";

  return `Navigated to ${pathname}`;
}

export function ActivityTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedPath = useRef<string>("");
  const locationSent = useRef<boolean>(false);

  // 1. Track page view on route change
  useEffect(() => {
    const sp = searchParams?.toString();
    const fullPath = sp ? `${pathname}?${sp}` : pathname;

    if (lastTrackedPath.current === fullPath) return;
    lastTrackedPath.current = fullPath;

    const title = getRouteTitle(pathname);

    fetch("/api/activity/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activityType: "PAGE_VIEW",
        title,
        route: fullPath,
        details: {
          pathname,
          search: sp || null,
          title: document.title,
          referrer: document.referrer || null,
          screen: `${window.innerWidth}x${window.innerHeight}`,
        },
      }),
    }).catch(() => {});
  }, [pathname, searchParams]);

  // 2. Active Session Heartbeat every 45 seconds
  useEffect(() => {
    const sendHeartbeat = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/activity/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route: pathname }),
      }).catch(() => {});
    };

    const interval = setInterval(sendHeartbeat, 45000);
    return () => clearInterval(interval);
  }, [pathname]);

  // 3. User Interaction Tracking (important button clicks, exports, form submits)
  useEffect(() => {
    let lastClickTime = 0;

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest("button, a.btn, a.btn-primary, a.btn-ghost, [role='button']") as HTMLElement | null;
      if (!target) return;

      const now = Date.now();
      if (now - lastClickTime < 1000) return; // Debounce 1s
      lastClickTime = now;

      const rawText = target.innerText?.trim() || target.getAttribute("aria-label") || target.getAttribute("title") || "";
      if (!rawText || rawText.length > 50) return;

      // Filter out navigation clicks which are already tracked as PAGE_VIEW
      if (target.tagName.toLowerCase() === "a" && target.getAttribute("href")?.startsWith("/")) return;

      fetch("/api/activity/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType: "ACTION",
          title: `Clicked action: "${rawText}"`,
          route: pathname,
          details: {
            buttonText: rawText,
            element: target.tagName.toLowerCase(),
            classes: target.className,
          },
        }),
      }).catch(() => {});
    };

    document.addEventListener("click", handleClick, { capture: true, passive: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, [pathname]);

  // 4. Optional Geolocation check
  useEffect(() => {
    if (locationSent.current || typeof window === "undefined" || !navigator.geolocation) return;

    if ("permissions" in navigator) {
      navigator.permissions.query({ name: "geolocation" as PermissionName }).then((result) => {
        if (result.state === "granted") {
          navigator.geolocation.getCurrentPosition((pos) => {
            locationSent.current = true;
            fetch("/api/activity/track", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                activityType: "LOCATION_PING",
                title: "Reported precise device coordinates",
                route: pathname,
                details: {
                  lat: pos.coords.latitude,
                  lon: pos.coords.longitude,
                  accuracyMeters: pos.coords.accuracy,
                },
              }),
            }).catch(() => {});
          });
        }
      }).catch(() => {});
    }
  }, [pathname]);

  return null;
}
