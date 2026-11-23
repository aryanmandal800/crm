import { requirePage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { getStaffMonitoringData } from "@/lib/staffMonitor";
import { StaffMonitorClient } from "./StaffMonitorClient";
import Link from "next/link";
import { ShieldCheck, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StaffMonitorPage() {
  const ctx = await requirePage("dashboard.founder", "audit.view");

  const initialData = await getStaffMonitoringData({
    role: "ALL",
    range: "today",
    limit: 200,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Staff Activity & Login Monitor"
        sub="Real-time employee monitoring for CEO: login/logout timestamps, active session duration, IP addresses, locations, and comprehensive activity audit trail."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/command-centre" className="btn-ghost text-xs">
              ← Founder's Command Centre
            </Link>
            <Link href="/admin/audit" className="btn-ghost text-xs">
              System Audit Logs
            </Link>
          </div>
        }
      />

      <StaffMonitorClient initialData={initialData} />
    </div>
  );
}
