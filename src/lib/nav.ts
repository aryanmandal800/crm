import type { Ctx } from "./auth";
import type { Permission } from "./permissions";
import type { NavItem } from "@/components/client/Nav";

const ITEMS: (NavItem & { any: Permission[] | "*" })[] = [
  { href: "/command-centre", label: "Founder's Command Centre", group: "Overview", any: ["dashboard.founder"] },
  { href: "/dashboard", label: "Analytics dashboard", group: "Overview", any: ["reports.view.all", "reports.view.team"] },
  { href: "/my-day", label: "My day", group: "Overview", any: ["activity.create"] },
  { href: "/work-tracker", label: "Work Tracker & EOD", group: "Overview", any: "*" },
  { href: "/leads", label: "Lead database", group: "Sales", any: ["lead.view.all", "lead.view.team", "lead.view.own"] },
  { href: "/pipeline", label: "Deal pipeline", group: "Sales", any: ["deal.view"] },
  { href: "/activities", label: "Activities", group: "Sales", any: ["activity.create", "reports.view.all", "reports.view.team"] },
  { href: "/tasks", label: "Tasks", group: "Sales", any: "*" },
  { href: "/decision-makers", label: "Decision makers", group: "Sales", any: ["lead.view.all", "lead.view.team", "lead.view.own"] },
  { href: "/quotes", label: "Quotes & proposals", group: "Sales", any: ["quote.create", "pricing.approve"] },
  { href: "/approvals", label: "Approvals", group: "Sales", any: ["pricing.approve", "cr.approve"] },
  { href: "/lost-deals", label: "Lost deals & objections", group: "Sales", any: ["deal.view"] },
  { href: "/onboarding", label: "Customer onboarding", group: "Sales", any: ["onboarding.view"] },
  { href: "/competitors", label: "Competitor intelligence", group: "Intelligence", any: ["competitor.view"] },
  { href: "/society-finder", label: "Society finder", group: "Intelligence", any: "*" },
  { href: "/sources", label: "Research sources", group: "Intelligence", any: ["research.edit"] },
  { href: "/catalogue", label: "Products & pricing", group: "Intelligence", any: ["pricing.view", "pricing.config"] },
  { href: "/performance", label: "Team performance", group: "Reports", any: ["performance.view.all", "performance.view.team", "performance.view.own"] },
  { href: "/reports", label: "Reports & exports", group: "Reports", any: ["reports.export"] },
  { href: "/change-requests", label: "Change requests", group: "Admin", any: ["cr.create", "cr.manage", "cr.approve"] },
  { href: "/admin/settings", label: "Settings & rules", group: "Admin", any: ["settings.business", "settings.technical", "taxonomy.manage"] },
  { href: "/admin/users", label: "Users & teams", group: "Admin", any: ["users.manage", "users.support"] },
  { href: "/admin/roles", label: "Roles & permissions", group: "Admin", any: ["roles.manage"] },
  { href: "/admin/grants", label: "Data-access grants", group: "Admin", any: ["grants.manage"] },
  { href: "/admin/audit", label: "Audit log", group: "Admin", any: ["audit.view", "audit.view.technical"] },
  { href: "/tech", label: "Technical dashboard", group: "Admin", any: ["tech.dashboard"] },
];

export function navFor(ctx: Ctx): NavItem[] {
  return ITEMS.filter((i) => i.any === "*" || i.any.some((p) => ctx.can(p))).map(({ href, label, group }) => ({ href, label, group }));
}
export function homeFor(ctx: Ctx) {
  if (ctx.can("dashboard.founder")) return "/command-centre";
  if (ctx.can("tech.dashboard")) return "/tech";
  if (ctx.can("activity.create")) return "/my-day";
  return navFor(ctx)[0]?.href ?? "/tasks";
}
