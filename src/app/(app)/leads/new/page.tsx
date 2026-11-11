import { requirePage } from "@/lib/auth";
import { assignable, opt, options } from "@/lib/options";
import { leadSections } from "@/lib/leadFields";
import { Card, PageHeader } from "@/components/ui";
import { JsonForm } from "@/components/client/JsonForm";
export const dynamic = "force-dynamic";
export default async function NewLead() {
  const ctx = await requirePage("lead.create");
  const o = await options();
  const secs = leadSections({ types: opt(o.types), districts: opt(o.districts), talukas: opt(o.talukas), owners: ctx.can("lead.assign") ? opt(assignable(ctx, o.users)) : undefined });
  const identityFields = secs.find((s) => s.key === "identity")?.fields ?? [];
  const authFields = secs.find((s) => s.key === "authorizedPerson")?.fields ?? [];
  const contactFields = secs.find((s) => s.key === "contact")?.fields ?? [];
  const financialFields = secs.find((s) => s.key === "financial")?.fields.slice(0, 3) ?? [];
  const fields = [...identityFields, ...authFields, ...contactFields, ...financialFields];
  return (<>
    <PageHeader title="Add institution" sub="Enter whatever details you have — only registered name is required. All other fields are optional and can be updated later as discussions progress." />
    <Card><JsonForm action="/api/leads" fields={fields} initial={{ districtId: o.districts[0]?.id }} redirectTo="/leads/{id}" submitLabel="Create institution" /></Card>
  </>);
}
