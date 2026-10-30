import { notFound } from "next/navigation";
import { requirePage } from "@/lib/auth";
import { getInstitutionOr404 } from "@/lib/access";
import { options } from "@/lib/options";
import { allSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { QuoteBuilder } from "@/components/client/QuoteBuilder";
export const dynamic = "force-dynamic";
export default async function NewQuote({ searchParams }: { searchParams: Promise<{ institution?: string; deal?: string }> }) {
  const ctx = await requirePage("quote.create"); const sp = await searchParams;
  if (!sp.institution) return <PageHeader title="New quote" sub="Open an institution or deal and choose “New quote”." />;
  const inst = await getInstitutionOr404(ctx, sp.institution).catch(() => null); if (!inst) notFound();
  const o = await options(); const s = await allSettings();
  return (<>
    <PageHeader title={`New quote — ${inst.legalName}`} sub="Prices are calculated on the server from the current pricing rules. Discounts beyond the limit or below the floor go to the Super Admin for approval." />
    <QuoteBuilder institutionId={inst.id} dealId={sp.deal ?? null} members={inst.activeMembers ?? inst.totalMembers ?? 0} branches={inst.branchCount ?? 1}
      modules={o.modules.map((m) => ({ value: m.key, label: m.name, core: m.isCore }))} defaultModules={inst.insights?.modules ?? o.modules.filter((m) => m.isCore).map((m) => m.key)}
      terms={String(s.get("pricing.terms"))} milestones={s.get("pricing.milestones") as any} maxDiscount={Number(s.get("pricing.maxDiscountNoApprovalPct"))} />
  </>);
}
