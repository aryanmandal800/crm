import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { getInstitutionOr404 } from "@/lib/access";
import { assignable, opt, options } from "@/lib/options";
import { leadSections } from "@/lib/leadFields";
import { EXEC_EDITABLE } from "@/lib/leads";
import { Card, PageHeader } from "@/components/ui";
import { JsonForm } from "@/components/client/JsonForm";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function EditLead({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage("lead.edit");
  const { id } = await params;
  const inst = await getInstitutionOr404(ctx, id).catch(() => null); if (!inst) notFound();
  const o = await options();
  const full = ctx.can("research.edit");
  const secs = leadSections({ types: opt(o.types), districts: opt(o.districts), talukas: opt(o.talukas), owners: ctx.can("lead.assign") ? opt(assignable(ctx, o.users)) : undefined })
    .map((s) => ({ ...s, fields: full ? s.fields : s.fields.filter((f) => EXEC_EDITABLE.includes(f.name)) })).filter((s) => s.fields.length);
  return (<>
    <PageHeader title={`Edit — ${inst.legalName}`} sub={full ? "Each section saves separately. Scores recalculate automatically." : "Your role can update contact details and notes."} actions={<Link href={`/leads/${id}`} className="btn-ghost">Back to profile</Link>} />
    <div className="space-y-4">{secs.map((s) => <Card key={s.key} title={s.title}><JsonForm action={`/api/leads/${id}`} method="PATCH" fields={s.fields} initial={inst as any} cols={3} /></Card>)}</div>
  </>);
}
