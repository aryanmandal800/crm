import { redirect } from "next/navigation";
import { getCtx } from "@/lib/auth";
import { JsonForm } from "@/components/client/JsonForm";
export const dynamic = "force-dynamic";
export default async function ChangePassword() {
  const ctx = await getCtx(); if (!ctx) redirect("/login");
  return (
    <div className="grid min-h-screen place-items-center bg-ink-50 p-4">
      <div className="card w-full max-w-sm p-6">
        <h1 className="h2 mb-1">Set a new password</h1>
        <p className="muted mb-4">{ctx.user.mustChangePassword ? "You must change the temporary password before continuing." : "Change your password."} Minimum 10 characters, letters and numbers.</p>
        <JsonForm action="/api/auth/password" cols={1} redirectTo="/" submitLabel="Update password" fields={[
          { name: "current", label: "Current password", type: "password", required: true },
          { name: "next", label: "New password", type: "password", required: true },
        ]} />
      </div>
    </div>
  );
}
