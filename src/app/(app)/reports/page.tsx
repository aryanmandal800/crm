import { requirePage } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
export const dynamic = "force-dynamic";
const R: [string, string, string][] = [
  ["leads", "Lead database", "All institutions in your scope with score, opportunity, verification and missing info."],
  ["activities", "Activities", "Calls, WhatsApp, emails, meetings, demos with outcomes and follow-ups."],
  ["pipeline", "Pipeline", "Every deal with stage, owner, MRR, probability and next action."],
  ["forecast", "Revenue forecast", "Open deals weighted by probability, grouped by expected close month, plus won MRR."],
  ["performance", "Salesperson performance", "Calls, DMs, meetings, demos, proposals, wins, conversion, follow-up discipline (30 days)."],
  ["talukas", "Taluka coverage", "Institutions vs contacted, hot/warm, open deals and MRR per taluka."],
  ["pricing", "Pricing", "Catalogue, slabs, pricing rules and all quotations."],
  ["lost", "Lost deals", "Lost reasons, competitors and notes."],
];
export default async function Reports() {
  await requirePage("reports.export");
  return (<>
    <PageHeader title="Reports & exports" sub="Exports respect your data scope and are recorded in the audit log." />
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{R.map(([k, title, d]) => (
      <Card key={k} title={title}><p className="muted mb-3">{d}</p><div className="flex gap-2"><a className="btn-primary" href={`/api/export/${k}`}>Excel</a><a className="btn-ghost" href={`/api/export/${k}?format=csv`}>CSV</a></div></Card>))}</div>
  </>);
}
