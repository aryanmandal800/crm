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
    <div className="mb-4 flex items-center gap-3.5 rounded-2xl border border-ink-200 bg-white p-4 shadow-sm">
      <div className="flex h-12 w-24 shrink-0 items-center justify-center rounded-xl border border-ink-100 bg-white p-1.5 shadow-2xs">
        <img src="/manalix_logo.svg" alt="Manalix Technologies" className="h-full w-auto object-contain" />
      </div>
      <div>
        <h1 className="text-lg font-bold text-ink-950">New Commercial Quotation — {inst.legalName}</h1>
        <p className="text-xs text-ink-600">
          Official quotation builder powered by Manalix Technologies commercial policy. Discounts beyond limit require Super Admin approval.
        </p>
      </div>
    </div>
    <QuoteBuilder institutionId={inst.id} dealId={sp.deal ?? null} members={inst.activeMembers ?? inst.totalMembers ?? 0} branches={inst.branchCount ?? 1}
      modules={o.modules.map((m) => ({ value: m.key, label: m.name, core: m.isCore, price: m.price, category: m.category, description: m.description }))} defaultModules={inst.insights?.modules ?? o.modules.filter((m) => m.isCore).map((m) => m.key)}
      terms={String(s.get("pricing.terms"))} milestones={s.get("pricing.milestones") as any} maxDiscount={Number(s.get("pricing.maxDiscountNoApprovalPct"))} />
  </>);
}
