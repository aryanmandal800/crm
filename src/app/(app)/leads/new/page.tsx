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
  const fields = [...secs[0].fields, ...secs[1].fields, ...secs[2].fields.slice(0, 3)];
  return (<>
    <PageHeader title="Add institution" sub="Record only what you can source. Leave unknowns blank — they show as “Not publicly verified”. Add evidence on the profile after saving." />
    <Card><JsonForm action="/api/leads" fields={fields} initial={{ districtId: o.districts[0]?.id }} redirectTo="/leads/{id}" submitLabel="Create institution" /></Card>
  </>);
}
