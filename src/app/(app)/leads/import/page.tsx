import { requirePage } from "@/lib/auth";
import { assignable, options } from "@/lib/options";
import { PageHeader } from "@/components/ui";
import { ImportWizard } from "@/components/client/ImportWizard";
export const dynamic = "force-dynamic";
export default async function Import() {
  const ctx = await requirePage("lead.import");
  const o = await options();
  return (<>
    <PageHeader title="Bulk import institutions" sub="CSV only. Duplicates (same registration no., or same name in the same taluka) are skipped. Every row is linked to the source you name below." />
    <ImportWizard districts={o.districts.map((d) => ({ value: d.id, label: d.name }))} types={o.types.map((x) => ({ value: x.key, label: x.name }))}
      owners={ctx.can("lead.assign") ? assignable(ctx, o.users).map((u) => ({ value: u.id, label: u.name })) : []} />
  </>);
}
