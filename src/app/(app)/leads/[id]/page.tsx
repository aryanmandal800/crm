import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import {
  Globe,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Users,
  Smartphone,
  Server,
  CreditCard,
  Building2,
  Layers,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { dealScope, getInstitutionOr404 } from "@/lib/access";
import { enumOpt, options } from "@/lib/options";
import { priceFor } from "@/lib/pricing";
import { OPPORTUNITY_CATEGORIES } from "@/lib/scoring";
import { SIGNAL_LABELS } from "@/lib/schemas";
import { dt, dtt, inr, label, num } from "@/lib/format";
import { AiBox, Badge, BandBadge, Card, Empty, Fact, PageHeader } from "@/components/ui";
import { JsonForm } from "@/components/client/JsonForm";
import { ActionButton } from "@/components/client/ActionButton";
import { GenerateAiInsightsButton } from "@/components/client/GenerateAiInsightsButton";
import { Disclosure } from "@/components/client/Disclosure";
import { LeadFinanceCharts } from "@/components/client/LeadFinanceCharts";

export const dynamic = "force-dynamic";

const FIELD_KEYS = [
  "legalName", "regNumber", "regDate", "address", "taluka", "branchCount", "website",
  "landline", "mobile", "email", "totalMembers", "activeMembers", "totalDeposits",
  "loanBook", "totalAssets", "annualProfit", "netWorth", "employeeCount", "cbsVendor",
  "cbsProduct", "hosting", "mobileApp", "ekyc", "upiIntegration", "centralisedCbs", "branchLocations"
];

function TriStateBadge({ value, name }: { value: string | null | undefined; name: string }) {
  if (value === "YES") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
        <CheckCircle2 size={13} className="text-emerald-600" />
        <span>Active (YES)</span>
      </span>
    );
  }
  if (value === "NO") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
        <XCircle size={13} className="text-rose-600" />
        <span>Not Available (NO)</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-600">
      <HelpCircle size={13} className="text-ink-400" />
      <span>Unknown</span>
    </span>
  );
}

export default async function LeadProfile({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage("lead.view.all", "lead.view.team", "lead.view.own");
  const { id } = await params;
  const base = await getInstitutionOr404(ctx, id).catch(() => null);
  if (!base) notFound();

  const i = (await db.query.institutions.findFirst({
    where: eq(t.institutions.id, id),
    with: {
      type: true,
      taluka: true,
      district: true,
      owner: true,
      contacts: true,
      signals: true,
      sources: true,
    },
  }))!;

  const o = await options();
  const [acts, deals, quotes] = await Promise.all([
    db.query.activities.findMany({
      where: eq(t.activities.institutionId, id),
      with: { user: true, contact: true },
      orderBy: desc(t.activities.occurredAt),
      limit: 100,
    }),
    ctx.can("deal.view")
      ? db.query.deals.findMany({
          where: and(eq(t.deals.institutionId, id), dealScope(ctx)),
          with: { stage: true, owner: true },
        })
      : Promise.resolve([]),
    ctx.can("pricing.view")
      ? db.select().from(t.quotes).where(eq(t.quotes.institutionId, id)).orderBy(desc(t.quotes.createdAt))
      : Promise.resolve([]),
  ]);

  const fs = (i.factStatus ?? {}) as Record<string, string>;
  const members = i.activeMembers ?? i.totalMembers;
  const insightModules = (i.insights?.modules ?? []).filter((k) => o.modules.some((m) => m.key === k));
  const price = ctx.can("pricing.view")
    ? await priceFor({ members: members ?? null, branches: i.branchCount, modules: insightModules })
    : null;
  const manualParams = o.params.filter((p) => p.kind === "MANUAL");
  const ro = !!ctx.grant;
  const canResearch = ctx.can("research.edit") && !ro;

  const branchList = i.branchLocations
    ? i.branchLocations
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return (
    <>
      <PageHeader
        title={i.legalName}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{i.leadCode}</span>
            <BandBadge band={i.scoreBand} score={i.score} />
            <Badge v={i.verification} />
            <span className="text-xs font-medium text-ink-600">
              {OPPORTUNITY_CATEGORIES[i.opportunityCategory] ?? i.opportunityCategory}
            </span>
            <span className="text-xs text-ink-500">
              · {i.type.name}
              {i.type.isPrimary ? "" : " (expansion category)"}
            </span>
            <span className="text-xs text-ink-500">· Owner: {i.owner?.name ?? "Unassigned"}</span>
            {i.tags.map((tg) => (
              <Badge key={tg} v="TAG">
                #{tg}
              </Badge>
            ))}
          </span>
        }
        actions={
          !ro && (
            <>
              {ctx.can("lead.edit") && (
                <Link href={`/leads/${id}/edit`} className="btn-ghost">
                  Edit
                </Link>
              )}
              {(ctx.can("research.edit") || ctx.can("pricing.view")) && (
                <GenerateAiInsightsButton
                  institutionId={id}
                  legalName={i.legalName}
                />
              )}
              {ctx.can("quote.create") && (
                <Link href={`/quotes/new?institution=${id}`} className="btn-ghost">
                  New quote
                </Link>
              )}
              {ctx.can("lead.delete") && (
                <ActionButton
                  url={`/api/leads/${id}`}
                  method="DELETE"
                  label="Archive"
                  confirm="Archive this institution? It will be hidden from lists (audit trail kept)."
                  redirectTo="/leads"
                  className="btn-ghost text-red-600"
                />
              )}
            </>
          )
        }
      />

      {/* ── TOP HIGHLIGHT: Opportunity AI Insights (Prominent & Clear) ── */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-violet-600" />
            <span>AI Strategic Opportunity Insights</span>
          </div>
        }
        actions={
          i.insightsSource ? (
            <span className="text-xs text-violet-700 font-medium">
              Source: {i.insightsSource} · {dtt(i.insightsAt)}
            </span>
          ) : null
        }
        className="mb-4 border-violet-200 bg-gradient-to-r from-violet-50/40 via-white to-purple-50/30"
      >
        {i.insights ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-violet-100 bg-white p-3.5 shadow-xs">
                <dt className="text-xs font-bold uppercase tracking-wider text-violet-800 flex items-center gap-1.5">
                  <TrendingUp size={14} />
                  <span>Why Approach (Strategic Target)</span>
                </dt>
                <dd className="mt-1.5 text-sm text-ink-800 leading-relaxed">{i.insights.whyApproach}</dd>
              </div>

              <div className="rounded-xl border border-amber-100 bg-white p-3.5 shadow-xs">
                <dt className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                  <Sparkles size={14} />
                  <span>Why Now (Urgency Trigger)</span>
                </dt>
                <dd className="mt-1.5 text-sm text-ink-800 leading-relaxed">{i.insights.whyNow}</dd>
              </div>

              <div className="rounded-xl border border-rose-100 bg-white p-3.5 shadow-xs">
                <dt className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                  <Layers size={14} />
                  <span>Identified Technology Gaps & Pain Points</span>
                </dt>
                <dd className="mt-1.5 text-sm text-ink-800 leading-relaxed">{i.insights.painPoint}</dd>
              </div>

              <div className="rounded-xl border border-sky-100 bg-white p-3.5 shadow-xs">
                <dt className="text-xs font-bold uppercase tracking-wider text-sky-800 flex items-center gap-1.5">
                  <Users size={14} />
                  <span>Key Influencers & Decision Makers</span>
                </dt>
                <dd className="mt-1.5 text-sm text-ink-800 leading-relaxed">
                  {Array.isArray(i.insights.influencers)
                    ? (i.insights.influencers as any[]).map((inf) => typeof inf === "string" ? inf : `${inf.name} (${inf.designation || inf.role})`).join("; ")
                    : String(i.insights.influencers || "")}
                </dd>
              </div>
            </div>

            {/* Modules to pitch */}
            <div className="rounded-xl border border-ink-100 bg-white p-3.5 shadow-xs">
              <div className="text-xs font-bold uppercase tracking-wider text-violet-800 mb-2">
                Recommended Modules to Pitch
              </div>
              <div className="flex flex-wrap gap-1.5">
                {i.insights.modules.length > 0 ? (
                  i.insights.modules.map((m) => (
                    <span
                      key={m}
                      className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800"
                    >
                      {o.modules.find((x) => x.key === m)?.name ?? m}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-ink-400">Standard Core Banking suite</span>
                )}
              </div>
            </div>

            {/* Grounded Evidence from Website */}
            {i.insights.evidence && i.insights.evidence.length > 0 && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1.5">
                  Verified Evidence Extracted from Web & Official Sources
                </div>
                <ul className="space-y-1 text-xs text-ink-700">
                  {i.insights.evidence.map((e, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold shrink-0">✓</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next best action callout */}
            <div className="rounded-xl border border-violet-300 bg-gradient-to-r from-violet-600 to-indigo-600 p-4 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-violet-200">
                  Recommended Next Best Action
                </div>
                <div className="text-sm font-semibold mt-0.5">{i.insights.nextAction}</div>
              </div>
              {ctx.can("activity.create") && !ro && (
                <a
                  href="#activities-section"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-violet-800 hover:bg-violet-50 transition shadow-sm"
                >
                  <span>Log Activity</span>
                </a>
              )}
            </div>

            <p className="text-[11px] text-violet-600 italic">{i.insights.disclaimer}</p>
          </div>
        ) : (
          <Empty>
            No AI insights generated yet. Click <b>“Generate AI insights”</b> above to research the official website, extract branches, members, and management.
          </Empty>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── LEFT COLUMN (lg:col-span-2): Main Sections ── */}
        <div className="space-y-4 lg:col-span-2">
          {/* ── SECTION 1: Financial Analytics & Growth (with Graph Form) ── */}
          <Card
            title={
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-brand-600" />
                <span>Financial Analytics & Scale Model</span>
              </div>
            }
            actions={
              <span className="text-xs text-ink-500">
                {i.financialYear ? `FY ${i.financialYear}` : (i.totalDeposits ? "Published Financials" : "Data Not Available")}
              </span>
            }
          >
            <LeadFinanceCharts
              totalMembers={i.totalMembers}
              activeMembers={i.activeMembers}
              totalDeposits={i.totalDeposits}
              loanBook={i.loanBook}
              totalAssets={i.totalAssets}
              annualProfit={i.annualProfit}
              netWorth={i.netWorth}
              branchCount={i.branchCount}
              financialYear={i.financialYear}
              investments={i.insights?.investments}
              cdRatio={i.insights?.cdRatio}
              crar={i.insights?.crar}
              yearWiseMetrics={i.insights?.yearWiseMetrics}
            />

            <Disclosure label="View Detailed Balance Sheet Fields" className="mt-4">
              <dl className="grid grid-cols-2 gap-3 pt-2 text-sm sm:grid-cols-3">
                <Fact k="Total Members" v={i.totalMembers != null ? num(i.totalMembers) : null} status={fs.totalMembers} />
                <Fact k="Active Members" v={i.activeMembers != null ? num(i.activeMembers) : null} status={fs.activeMembers} />
                <Fact k="Deposits" v={i.totalDeposits != null ? inr(i.totalDeposits) : null} status={fs.totalDeposits} />
                <Fact k="Loan Book" v={i.loanBook != null ? inr(i.loanBook) : null} status={fs.loanBook} />
                <Fact k="Total Assets" v={i.totalAssets != null ? inr(i.totalAssets) : null} status={fs.totalAssets} />
                <Fact k="Annual Profit" v={i.annualProfit != null ? inr(i.annualProfit) : null} status={fs.annualProfit} />
                <Fact k="Net Worth" v={i.netWorth != null ? inr(i.netWorth) : null} status={fs.netWorth} />
                <Fact k="Employees" v={i.employeeCount != null ? num(i.employeeCount) : null} status={fs.employeeCount} />
                <Fact k="Financial Confidence" v={i.financialConfidence ? label(i.financialConfidence) : null} />
              </dl>
            </Disclosure>
          </Card>

          {/* ── SECTION: Business Growth Trajectory & Historical Milestones ── */}
          {i.insights?.growthTrajectory && (
            <Card
              title={
                <div className="flex items-center gap-2">
                  <TrendingUp size={18} className="text-emerald-600" />
                  <span>Business Growth Trajectory & Historical Scale</span>
                </div>
              }
              actions={
                <Badge v="PUBLICLY_REPORTED">Verified Growth History</Badge>
              }
            >
              <div className="space-y-4">
                {/* Executive Growth Narrative */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-emerald-950 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-xs">
                      📈
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-emerald-900 mb-1">
                        Historical Journey & Business Evolution
                      </h4>
                      <p className="text-xs text-emerald-900/90 leading-relaxed font-normal">
                        {i.insights.growthTrajectory}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Year-wise Milestones Grid */}
                {i.insights.yearWiseMetrics && i.insights.yearWiseMetrics.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-600">
                      Historical Milestones & Year-Wise Scale
                    </div>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {i.insights.yearWiseMetrics.map((m, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-ink-100 bg-white p-3 shadow-xs hover:border-brand-300 transition"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="rounded-md bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-800">
                              {m.year}
                            </span>
                            {m.branches && (
                              <span className="text-[11px] font-semibold text-violet-700">
                                {m.branches} Branches
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 text-xs font-semibold text-ink-900">
                            {m.milestone}
                          </div>
                          {(m.deposits || m.loans || m.netWorth) && (
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] pt-1.5 border-t border-ink-100 text-ink-600">
                              {m.deposits && (
                                <span>Deposits: <b className="text-brand-600">{inr(m.deposits, { compact: true })}</b></span>
                              )}
                              {m.loans && (
                                <span>Loans: <b className="text-cyan-700">{inr(m.loans, { compact: true })}</b></span>
                              )}
                              {m.netWorth && (
                                <span>Net Worth: <b className="text-emerald-700">{inr(m.netWorth, { compact: true })}</b></span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Discovered Performance Indicators */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-1 text-xs">
                  {i.insights.cdRatio != null && (
                    <div className="rounded-lg bg-ink-50 p-2.5">
                      <span className="text-[10px] text-ink-500 block uppercase font-medium">Credit-Deposit Ratio</span>
                      <span className="text-sm font-bold text-ink-900">{i.insights.cdRatio}%</span>
                    </div>
                  )}
                  {i.insights.crar != null && (
                    <div className="rounded-lg bg-ink-50 p-2.5">
                      <span className="text-[10px] text-ink-500 block uppercase font-medium">CRAR (Capital Adequacy)</span>
                      <span className="text-sm font-bold text-ink-900">{i.insights.crar}%</span>
                    </div>
                  )}
                  {i.insights.workingCapital != null && (
                    <div className="rounded-lg bg-ink-50 p-2.5">
                      <span className="text-[10px] text-ink-500 block uppercase font-medium">Working Capital</span>
                      <span className="text-sm font-bold text-ink-900">{inr(i.insights.workingCapital, { compact: true })}</span>
                    </div>
                  )}
                  {i.insights.investments != null && (
                    <div className="rounded-lg bg-ink-50 p-2.5">
                      <span className="text-[10px] text-ink-500 block uppercase font-medium">Total Investments</span>
                      <span className="text-sm font-bold text-ink-900">{inr(i.insights.investments, { compact: true })}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* ── SECTION 2: Institution Profile & Online Presence ── */}
          <Card
            title={
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-ink-700" />
                <span>Institution Profile & Web Presence</span>
              </div>
            }
          >
            <div className="space-y-4">
              {/* Official Website Highlight Banner */}
              {i.website ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50/70 p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white shadow-sm">
                      <Globe size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-sky-800">
                          Official Website
                        </span>
                        <Badge v="PUBLICLY_REPORTED">Extracted</Badge>
                      </div>
                      <a
                        href={i.website}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate font-semibold text-sky-900 hover:underline text-sm"
                      >
                        {i.website}
                      </a>
                    </div>
                  </div>
                  <a
                    href={i.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 transition shadow-xs"
                  >
                    <span>Visit Official Site</span>
                    <ExternalLink size={13} />
                  </a>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-dashed border-ink-200 p-3 text-xs text-ink-500">
                  <span>No website on file. Use “Generate AI insights” to search for the official website.</span>
                </div>
              )}

              {/* Direct Contact Channels Grid */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-ink-100 bg-white p-3 shadow-xs">
                  <div className="text-xs font-medium text-ink-500 flex items-center gap-1.5">
                    <Phone size={13} className="text-brand-600" />
                    <span>Official Landline</span>
                  </div>
                  <div className="mt-1 font-semibold text-sm text-ink-900">
                    {i.landline ? (
                      <a href={`tel:${i.landline}`} className="hover:underline text-brand-600">
                        {i.landline}
                      </a>
                    ) : (
                      <span className="text-ink-400 font-normal">Not verified</span>
                    )}
                  </div>
                  {fs.landline && <Badge v={fs.landline} />}
                </div>

                <div className="rounded-xl border border-ink-100 bg-white p-3 shadow-xs">
                  <div className="text-xs font-medium text-ink-500 flex items-center gap-1.5">
                    <Smartphone size={13} className="text-emerald-600" />
                    <span>Mobile / WhatsApp</span>
                  </div>
                  <div className="mt-1 font-semibold text-sm text-ink-900">
                    {i.mobile ? (
                      <a href={`tel:${i.mobile}`} className="hover:underline text-emerald-700">
                        {i.mobile}
                      </a>
                    ) : (
                      <span className="text-ink-400 font-normal">Not verified</span>
                    )}
                  </div>
                  {fs.mobile && <Badge v={fs.mobile} />}
                </div>

                <div className="rounded-xl border border-ink-100 bg-white p-3 shadow-xs">
                  <div className="text-xs font-medium text-ink-500 flex items-center gap-1.5">
                    <Mail size={13} className="text-violet-600" />
                    <span>Official Email</span>
                  </div>
                  <div className="mt-1 font-semibold text-sm text-ink-900 truncate">
                    {i.email ? (
                      <a href={`mailto:${i.email}`} className="hover:underline text-violet-700">
                        {i.email}
                      </a>
                    ) : (
                      <span className="text-ink-400 font-normal">Not verified</span>
                    )}
                  </div>
                  {fs.email && <Badge v={fs.email} />}
                </div>
              </div>

              {/* Head office address & Map */}
              <div className="rounded-xl border border-ink-100 bg-white p-3.5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-600 flex items-center gap-1.5">
                    <MapPin size={14} className="text-red-500" />
                    <span>Head Office Address</span>
                  </span>
                  {i.mapsUrl && (
                    <a
                      href={i.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                    >
                      <span>Google Maps</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-ink-800 leading-relaxed">
                  {i.address || "Address not recorded"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-500">
                  <span>Taluka: {i.taluka?.name ?? "—"}</span>
                  <span>·</span>
                  <span>District: {i.district?.name ?? "—"}</span>
                  <span>·</span>
                  <span>PIN: {i.pinCode ?? "—"}</span>
                  <span>·</span>
                  <span>City: {i.city ?? "—"}</span>
                </div>
              </div>

              {/* Branch Network & Extracted Locations */}
              <div className="rounded-xl border border-ink-100 bg-white p-3.5 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-600 flex items-center gap-1.5">
                    <Building2 size={14} className="text-violet-600" />
                    <span>Branch Network & Locations</span>
                  </span>
                  <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-800">
                    {i.branchCount ?? branchList.length} {i.branchCount === 1 ? "Branch" : "Branches"}
                  </span>
                </div>

                {branchList.length > 0 ? (
                  <div className="mt-2.5">
                    <div className="text-xs text-ink-500 mb-1.5">Discovered Branch Locations:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {branchList.map((loc, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50/70 px-2.5 py-1 text-xs font-medium text-brand-800"
                        >
                          <MapPin size={11} className="text-brand-600" />
                          <span>{loc}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-ink-500">
                    Branch locations not itemized. Run “Generate AI insights” to pull branch locations from website.
                  </p>
                )}
              </div>

              {/* Legal & Registration Details */}
              <Disclosure label="Legal & Registration Details">
                <dl className="grid grid-cols-2 gap-3 pt-2 text-sm sm:grid-cols-4">
                  <Fact k="Reg. Number" v={i.regNumber} status={fs.regNumber} />
                  <Fact k="Registered Date" v={i.regDate ? dt(i.regDate) : null} status={fs.regDate} />
                  <Fact k="Authority" v={i.regAuthority} />
                  <Fact k="Multi-State" v={i.multiState == null ? null : i.multiState ? "Yes" : "No"} />
                  <Fact k="Status" v={i.status === "UNKNOWN" ? null : label(i.status)} />
                  <Fact k="Contact Verification" v={label(i.contactVerification)} />
                </dl>
              </Disclosure>
            </div>
          </Card>

          {/* ── SECTION 3: Core Banking & Technology Stack ── */}
          <Card
            title={
              <div className="flex items-center gap-2">
                <Server size={18} className="text-cyan-700" />
                <span>Technology & Digital Banking Stack</span>
              </div>
            }
          >
            <div className="space-y-4">
              {/* 6-Card Digital Banking Capabilities Grid */}
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                <div className="rounded-xl border border-ink-100 bg-white p-3 shadow-xs">
                  <div className="text-xs font-medium text-ink-500 flex items-center gap-1.5">
                    <Server size={14} className="text-brand-600" />
                    <span>Centralised CBS</span>
                  </div>
                  <div className="mt-2">
                    <TriStateBadge value={i.centralisedCbs} name="Centralised CBS" />
                  </div>
                  <div className="mt-1 text-[11px] text-ink-400">Multi-branch central DB</div>
                </div>

                <div className="rounded-xl border border-ink-100 bg-white p-3 shadow-xs">
                  <div className="text-xs font-medium text-ink-500 flex items-center gap-1.5">
                    <Smartphone size={14} className="text-emerald-600" />
                    <span>Member Mobile App</span>
                  </div>
                  <div className="mt-2">
                    <TriStateBadge value={i.mobileApp} name="Mobile App" />
                  </div>
                  <div className="mt-1 text-[11px] text-ink-400">Android/iOS digital app</div>
                </div>

                <div className="rounded-xl border border-ink-100 bg-white p-3 shadow-xs">
                  <div className="text-xs font-medium text-ink-500 flex items-center gap-1.5">
                    <CreditCard size={14} className="text-violet-600" />
                    <span>UPI & QR Integration</span>
                  </div>
                  <div className="mt-2">
                    <TriStateBadge value={i.upiIntegration} name="UPI" />
                  </div>
                  <div className="mt-1 text-[11px] text-ink-400">Instant UPI collection</div>
                </div>

                <div className="rounded-xl border border-ink-100 bg-white p-3 shadow-xs">
                  <div className="text-xs font-medium text-ink-500 flex items-center gap-1.5">
                    <Globe size={14} className="text-sky-600" />
                    <span>Internet Banking</span>
                  </div>
                  <div className="mt-2">
                    <TriStateBadge value={i.internetBanking} name="Internet Banking" />
                  </div>
                  <div className="mt-1 text-[11px] text-ink-400">Web customer portal</div>
                </div>

                <div className="rounded-xl border border-ink-100 bg-white p-3 shadow-xs">
                  <div className="text-xs font-medium text-ink-500 flex items-center gap-1.5">
                    <Layers size={14} className="text-amber-600" />
                    <span>Digital Loan Processing</span>
                  </div>
                  <div className="mt-2">
                    <TriStateBadge value={i.digitalLoans} name="Digital Loans" />
                  </div>
                  <div className="mt-1 text-[11px] text-ink-400">Paperless LOS / LMS</div>
                </div>

                <div className="rounded-xl border border-ink-100 bg-white p-3 shadow-xs">
                  <div className="text-xs font-medium text-ink-500 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-indigo-600" />
                    <span>eKYC Onboarding</span>
                  </div>
                  <div className="mt-2">
                    <TriStateBadge value={i.ekyc} name="eKYC" />
                  </div>
                  <div className="mt-1 text-[11px] text-ink-400">Aadhaar / OTP onboarding</div>
                </div>
              </div>

              {/* Current Vendor & Infrastructure */}
              <div className="rounded-xl border border-ink-100 bg-white p-3.5 shadow-xs">
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Fact k="CBS Vendor" v={i.cbsVendor} status={fs.cbsVendor} />
                  <Fact k="Product Name" v={i.cbsProduct} status={fs.cbsProduct} />
                  <Fact k="Vendor Status" v={label(i.vendorClass)} />
                  <Fact k="Hosting Architecture" v={i.hosting === "UNKNOWN" ? null : label(i.hosting)} status={fs.hosting} />
                  <div className="col-span-2">
                    <Fact k="Legacy Software Evidence" v={i.legacyEvidence} />
                  </div>
                  <div className="col-span-2">
                    <Fact k="Reported Tech Complaints" v={i.techComplaints} />
                  </div>
                </dl>
              </div>
            </div>
          </Card>

          {/* ── SECTION 4: Activity History ── */}
          <div id="activities-section">
            <Card
              title="Activity History & Follow-ups"
              actions={
                ctx.can("activity.create") && !ro ? (
                  <span className="text-xs text-ink-500">{acts.length} logged</span>
                ) : null
              }
            >
              {ctx.can("activity.create") && !ro && (
                <Disclosure label="Log call / meeting / demo" open={acts.length === 0}>
                  <JsonForm
                    action="/api/activities"
                    extra={{ institutionId: id }}
                    cols={3}
                    fields={[
                      {
                        name: "typeKey",
                        label: "Type",
                        type: "select",
                        required: true,
                        options: o.activityTypes.map((a) => ({ value: a.key, label: a.name })),
                      },
                      {
                        name: "status",
                        label: "Status",
                        type: "select",
                        required: true,
                        options: [
                          { value: "DONE", label: "Done" },
                          { value: "PLANNED", label: "Planned / scheduled" },
                        ],
                      },
                      { name: "occurredAt", label: "When", type: "datetime" },
                      {
                        name: "contactId",
                        label: "With",
                        type: "select",
                        options: i.contacts.map((c) => ({
                          value: c.id,
                          label: `${c.name} (${label(c.role)})`,
                        })),
                      },
                      {
                        name: "dealId",
                        label: "Deal",
                        type: "select",
                        options: deals.map((d) => ({ value: d.id, label: d.title })),
                      },
                      {
                        name: "outcome",
                        label: "Outcome",
                        type: "select",
                        options: enumOpt([
                          "CONNECTED",
                          "NO_ANSWER",
                          "WRONG_NUMBER",
                          "CALLBACK_REQUESTED",
                          "INTERESTED",
                          "NOT_INTERESTED",
                          "MEETING_BOOKED",
                          "DEMO_BOOKED",
                        ]),
                      },
                      { name: "decisionMakerReached", label: "Decision-maker reached", type: "checkbox" },
                      { name: "meaningful", label: "Meaningful conversation", type: "checkbox" },
                      { name: "notes", label: "Notes", type: "textarea" },
                      { name: "objection", label: "Objection raised" },
                      { name: "feedback", label: "Feedback" },
                      { name: "nextAction", label: "Next action" },
                      { name: "followUpDate", label: "Follow-up date", type: "datetime" },
                    ]}
                    initial={{ status: "DONE", typeKey: "CALL" }}
                    submitLabel="Log"
                  />
                </Disclosure>
              )}

              <ol className="mt-3 space-y-3">
                {acts.map((a) => (
                  <li key={a.id} className="border-l-2 border-brand-200 pl-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <b>{o.activityTypes.find((x) => x.key === a.typeKey)?.name ?? a.typeKey}</b>
                      {a.status !== "DONE" && <Badge v={a.status} />}
                      {a.outcome && <Badge v={a.outcome} />}
                      {a.decisionMakerReached && <Badge v="VERIFIED">DM reached</Badge>}
                      <span className="text-xs text-ink-500">
                        {dtt(a.occurredAt)} · {a.user.name}
                        {a.contact ? ` · with ${a.contact.name}` : ""}
                      </span>
                    </div>
                    {a.notes && <p className="mt-0.5 whitespace-pre-wrap">{a.notes}</p>}
                    {a.objection && <p className="text-xs text-red-700">Objection: {a.objection}</p>}
                    {a.feedback && <p className="text-xs text-ink-700">Feedback: {a.feedback}</p>}
                    {a.nextAction && (
                      <p className="text-xs text-brand-700">
                        Next: {a.nextAction}
                        {a.followUpDate ? ` — ${dtt(a.followUpDate)}` : ""}
                      </p>
                    )}
                  </li>
                ))}
                {!acts.length && <li className="text-sm text-ink-500">No activity logged yet.</li>}
              </ol>
            </Card>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Decision Makers, Scoring, Pricing & Sources ── */}
        <div className="space-y-4">
          {/* ── Lead Score ── */}
          <Card
            title={`Lead score ${i.score}/100`}
            actions={<span className="text-xs text-ink-500">Scored {dtt(i.scoredAt)}</span>}
          >
            <div className="space-y-2">
              {i.scoreBreakdown.map((l) => (
                <div key={l.key} className="grid grid-cols-[1fr_auto] gap-x-3 text-sm">
                  <div>
                    <span className="font-medium text-xs sm:text-sm">{l.name}</span>
                    <div className="text-[11px] text-ink-500">{l.reason}</div>
                  </div>
                  <div className="text-right font-semibold tabular-nums text-xs sm:text-sm">
                    {l.points}
                    <span className="text-ink-500">/{l.max}</span>
                  </div>
                  <div className="col-span-2 h-1.5 overflow-hidden rounded bg-ink-100">
                    <div className="h-full bg-brand-500" style={{ width: `${(l.points / l.max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            {i.missingInfo.length > 0 && (
              <div className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                <b>Missing information:</b> {i.missingInfo.join(" · ")}
              </div>
            )}
            {manualParams.length > 0 && canResearch && (
              <Disclosure label="Analyst scoring inputs">
                <JsonForm
                  action={`/api/leads/${id}/manual-scores`}
                  cols={2}
                  fields={manualParams.map((p) => ({
                    name: p.key,
                    label: `${p.name} (0–${p.maxScore})`,
                    type: "number",
                    help: p.guidance ?? undefined,
                  }))}
                  initial={i.manualScores}
                  extra={{}}
                  submitLabel="Save scores"
                />
              </Disclosure>
            )}
          </Card>

          {/* ── Pricing Recommendation ── */}
          {price && (
            <Card
              title="Pricing recommendation"
              actions={
                <Link
                  href={`/catalogue?members=${members ?? ""}&branches=${i.branchCount ?? ""}`}
                  className="link text-xs"
                >
                  Open calculator
                </Link>
              }
            >
              <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                <Fact k="Model" v={label(price.model)} />
                <Fact k="Monthly SaaS (list)" v={inr(price.monthly)} />
                <Fact k="Negotiation Floor" v={inr(price.negotiation.minAcceptableMonthly)} />
                <Fact k="Implementation" v={inr(price.oneTime)} />
                <Fact k="Annual Contract" v={inr(price.arr)} />
                <Fact k="Suggested Pilot" v={`${inr(price.pilot.fee)} (${price.pilot.months} mo)`} />
              </div>
              <p className="mt-2 text-xs text-ink-500">
                {price.commercialModel} {price.rationale.join(". ")}.
              </p>
            </Card>
          )}

          {/* ── Decision Makers ── */}
          <Card
            title={
              <div className="flex items-center justify-between">
                <span>Decision Makers</span>
                <span className="text-xs font-semibold text-ink-500">
                  {i.contacts.length} identified
                </span>
              </div>
            }
          >
            {i.contacts.map((c) => (
              <div key={c.id} className="mb-2.5 rounded-xl border border-ink-100 bg-white p-3 text-sm shadow-2xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <b className="text-ink-900">{c.name}</b>
                  <Badge v={c.verification} />
                  {c.isFinalApprover && <Badge v="APPROVED">Final approver</Badge>}
                  {c.isDecisionMaker && <Badge v="HIGH">Decision maker</Badge>}
                  {c.isChampion && <Badge v="SUCCESS">Champion</Badge>}
                  {c.isInfluencer && <Badge v="MEDIUM">Influencer</Badge>}
                </div>
                <div className="text-xs text-ink-600 mt-1 font-medium">
                  {c.designation ?? label(c.role)}
                </div>
                <div className="text-xs mt-1 flex flex-wrap gap-2 text-ink-700">
                  {c.businessPhone && (
                    <a href={`tel:${c.businessPhone}`} className="hover:underline text-brand-600 flex items-center gap-1">
                      <Phone size={11} />
                      <span>{c.businessPhone}</span>
                    </a>
                  )}
                  {c.businessEmail && (
                    <a href={`mailto:${c.businessEmail}`} className="hover:underline text-violet-700 flex items-center gap-1">
                      <Mail size={11} />
                      <span>{c.businessEmail}</span>
                    </a>
                  )}
                </div>
                {c.sourceUrl && (
                  <a className="link text-[11px] mt-1 inline-block" href={c.sourceUrl} target="_blank" rel="noreferrer">
                    Source Link
                  </a>
                )}
                {ctx.can("contact.edit") && !ro && (
                  <Disclosure label="Edit contact" className="mt-1">
                    <JsonForm action={`/api/contacts/${c.id}`} method="PATCH" cols={1} fields={contactFields} initial={c} />
                  </Disclosure>
                )}
              </div>
            ))}
            {!i.contacts.length && <p className="muted text-xs">No decision makers identified yet.</p>}
            {ctx.can("contact.edit") && !ro && (
              <Disclosure label="Add decision maker">
                <JsonForm
                  action={`/api/leads/${id}/contacts`}
                  cols={1}
                  fields={contactFields}
                  initial={{ role: "CEO_MD", verification: "UNVERIFIED", relationshipStrength: 0 }}
                  submitLabel="Add"
                />
              </Disclosure>
            )}
          </Card>

          {/* ── Research Sources & Provenance ── */}
          <Card title="Research Sources & Evidence">
            {i.sources.length ? (
              <ul className="space-y-2">
                {i.sources.map((s) => (
                  <li key={s.id} className="rounded-lg border border-ink-100 p-2.5 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <b>{s.name}</b>
                      <Badge v={s.classification} />
                      <span className="text-[11px] text-ink-500">accessed {dt(s.accessedAt)}</span>
                      {canResearch && (
                        <span className="ml-auto">
                          <ActionButton
                            url={`/api/sources/${s.id}`}
                            method="DELETE"
                            label="Remove"
                            confirm="Remove source?"
                            className="text-xs text-red-600"
                          />
                        </span>
                      )}
                    </div>
                    {s.url && (
                      <a className="link break-all text-[11px] mt-1 block" href={s.url} target="_blank" rel="noreferrer">
                        {s.url}
                      </a>
                    )}
                    {s.evidence && <p className="mt-1 whitespace-pre-wrap text-ink-700">“{s.evidence}”</p>}
                    {s.fieldKeys.length > 0 && (
                      <p className="text-[10px] text-ink-500 mt-1">Supports: {s.fieldKeys.join(", ")}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No sources recorded.</Empty>
            )}
            {canResearch && (
              <Disclosure label="Add source">
                <JsonForm
                  action={`/api/leads/${id}/sources`}
                  cols={1}
                  fields={[
                    { name: "name", label: "Source name", required: true, placeholder: "e.g. Society annual report" },
                    { name: "url", label: "URL" },
                    { name: "accessedAt", label: "Date accessed", type: "date" },
                    {
                      name: "classification",
                      label: "Classification",
                      type: "select",
                      options: enumOpt(["VERIFIED_FACT", "PUBLICLY_REPORTED", "ESTIMATE"]),
                    },
                    {
                      name: "fieldKeys",
                      label: "Fields this source supports",
                      type: "multiselect",
                      options: FIELD_KEYS.map((k) => ({ value: k, label: k })),
                    },
                    { name: "evidence", label: "Evidence extracted", type: "textarea" },
                  ]}
                  initial={{ classification: "PUBLICLY_REPORTED", verification: "UNVERIFIED", confidence: "MEDIUM", fieldKeys: [] }}
                  submitLabel="Add source"
                />
              </Disclosure>
            )}
          </Card>

          {/* ── Deals ── */}
          {ctx.can("deal.view") && (
            <Card title="Pipeline Deals">
              {deals.map((d) => (
                <Link
                  key={d.id}
                  href={`/deals/${d.id}`}
                  className="mb-2 block rounded-lg border border-ink-100 p-2 text-sm hover:border-brand-400"
                >
                  <div className="font-medium">{d.title}</div>
                  <div className="text-xs text-ink-500">
                    {d.stage.name} · {d.owner.name} · MRR {inr(d.mrr)}
                  </div>
                  {d.followUpDate && <div className="text-xs text-brand-700">Follow up {dt(d.followUpDate)}</div>}
                </Link>
              ))}
              {!deals.length && <p className="muted text-xs">No deals created yet.</p>}
              {ctx.can("deal.create") && !ro && (
                <Disclosure label="Create deal" open={!deals.length}>
                  <JsonForm
                    action="/api/deals"
                    extra={{ institutionId: id }}
                    cols={1}
                    redirectTo="/deals/{id}"
                    fields={[
                      { name: "title", label: "Deal title", required: true },
                      {
                        name: "stageId",
                        label: "Stage",
                        type: "select",
                        required: true,
                        options: o.stages.filter((s) => s.isOpen).map((s) => ({ value: s.id, label: s.name })),
                      },
                      {
                        name: "opportunityCategory",
                        label: "Opportunity",
                        type: "select",
                        required: true,
                        options: Object.entries(OPPORTUNITY_CATEGORIES).map(([value, l]) => ({ value, label: l })),
                      },
                      { name: "nextAction", label: "Next action", required: true },
                      { name: "followUpDate", label: "Follow-up date", type: "date", required: true },
                      { name: "mrr", label: "Expected MRR (₹)", type: "number" },
                    ]}
                    initial={{
                      title: `${i.shortName ?? i.legalName} — Fivopay`,
                      stageId: o.stages.find((s) => s.key === "NEW")?.id,
                      opportunityCategory: i.opportunityCategory === "NOT_QUALIFIED" ? "GREENFIELD_CBS" : i.opportunityCategory,
                      mrr: price?.monthly,
                    }}
                    submitLabel="Create deal"
                  />
                </Disclosure>
              )}
            </Card>
          )}

          {/* ── Buying signals ── */}
          <Card title="Buying Signals">
            {i.signals.length ? (
              <ul className="space-y-2">
                {i.signals.map((s) => (
                  <li key={s.id} className="rounded-lg border border-ink-100 p-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <b>{SIGNAL_LABELS[s.type] ?? s.type}</b>
                      <Badge v={s.strength}>strength {s.strength.toLowerCase()}</Badge>
                      <span className="text-[10px] text-ink-500">{dt(s.signalDate)}</span>
                      {canResearch && (
                        <span className="ml-auto">
                          <ActionButton
                            url={`/api/signals/${s.id}`}
                            method="DELETE"
                            label="Remove"
                            confirm="Remove signal?"
                            className="text-xs text-red-600"
                          />
                        </span>
                      )}
                    </div>
                    <p className="mt-1">{s.description}</p>
                    {s.evidenceUrl && (
                      <a className="link break-all text-[11px]" href={s.evidenceUrl} target="_blank" rel="noreferrer">
                        {s.evidenceUrl}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No buying signals recorded.</Empty>
            )}
            {canResearch && (
              <Disclosure label="Add signal">
                <JsonForm
                  action={`/api/leads/${id}/signals`}
                  cols={1}
                  fields={[
                    {
                      name: "type",
                      label: "Signal",
                      type: "select",
                      required: true,
                      options: Object.entries(SIGNAL_LABELS).map(([value, l]) => ({ value, label: l })),
                    },
                    { name: "signalDate", label: "Date", type: "date" },
                    { name: "evidenceUrl", label: "Evidence URL" },
                    { name: "strength", label: "Strength", type: "select", options: enumOpt(["LOW", "MEDIUM", "HIGH"]) },
                    { name: "description", label: "What happened (evidence)", type: "textarea", required: true },
                  ]}
                  initial={{ strength: "MEDIUM", confidence: "MEDIUM" }}
                  submitLabel="Add signal"
                />
              </Disclosure>
            )}
          </Card>

          {/* ── Qualification ── */}
          <Card title="Qualification Questionnaire">
            {ctx.can("lead.edit") && !ro ? (
              <QualificationForm id={id} questions={o.questions} answers={i.qualification} />
            ) : (
              <dl className="space-y-2 text-sm">
                {o.questions.map((q) => (
                  <div key={q.id}>
                    <dt className="text-xs text-ink-500">{q.text}</dt>
                    <dd>{i.qualification?.[q.id] ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>

          {quotes.length > 0 && (
            <Card title="Quotations">
              {quotes.map((q) => (
                <Link
                  key={q.id}
                  href={`/quotes/${q.id}`}
                  className="mb-1 flex justify-between text-sm hover:text-brand-600"
                >
                  <span>{q.number}</span>
                  <Badge v={q.status} />
                </Link>
              ))}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

const contactFields = [
  { name: "name", label: "Name", required: true },
  {
    name: "role",
    label: "Role",
    type: "select" as const,
    required: true,
    options: enumOpt([
      "CHAIRMAN",
      "VICE_CHAIRMAN",
      "SECRETARY",
      "CEO_MD",
      "GENERAL_MANAGER",
      "IT_MANAGER",
      "FINANCE_HEAD",
      "DIRECTOR",
      "BRANCH_MANAGER",
      "INFLUENCER",
      "OTHER",
    ]),
  },
  { name: "designation", label: "Designation (as published)" },
  { name: "businessPhone", label: "Business phone (public only)" },
  { name: "businessEmail", label: "Business email (public only)", type: "email" as const },
  { name: "linkedinUrl", label: "LinkedIn" },
  { name: "sourceUrl", label: "Source URL" },
  {
    name: "verification",
    label: "Verification",
    type: "select" as const,
    options: enumOpt(["UNVERIFIED", "PARTIAL", "VERIFIED", "DISPUTED"]),
  },
  { name: "relationshipStrength", label: "Relationship (0–5)", type: "number" as const },
  { name: "isDecisionMaker", label: "Decision maker", type: "checkbox" as const },
  { name: "isFinalApprover", label: "Final approving authority", type: "checkbox" as const },
  { name: "isChampion", label: "Internal champion", type: "checkbox" as const },
  { name: "isInfluencer", label: "Influencer", type: "checkbox" as const },
  { name: "notes", label: "Notes", type: "textarea" as const },
];

function QualificationForm({
  id,
  questions,
  answers,
}: {
  id: string;
  questions: { id: string; text: string }[];
  answers: Record<string, string>;
}) {
  return (
    <JsonForm
      action={`/api/leads/${id}/qualification`}
      cols={1}
      fields={questions.map((q) => ({ name: q.id, label: q.text, type: "textarea" }))}
      initial={answers}
      submitLabel="Save answers"
    />
  );
}
