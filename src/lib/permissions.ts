/** Permission catalogue. Enforced server-side in every API route and page loader. */
export const PERMISSIONS = {
  // leads / institutions — data scope is the strongest of view.all > view.team > view.own
  "lead.view.all": "View every institution",
  "lead.view.team": "View institutions owned by own team (and unassigned pool)",
  "lead.view.own": "View institutions assigned to me",
  "lead.create": "Add institutions",
  "lead.edit": "Edit institution details",
  "lead.assign": "Assign / reassign leads (within scope)",
  "lead.delete": "Archive (soft-delete) institutions",
  "lead.import": "Bulk import institutions",
  "research.edit": "Add sources, signals, verification status",
  "contact.edit": "Add / edit decision makers",
  // sales
  "activity.create": "Log activities",
  "deal.view": "View deals (within lead scope)",
  "deal.create": "Create deals",
  "deal.edit": "Update deals and stages",
  "deal.edit_locked": "Edit financials of closed/won deals",
  "pricing.view": "See pricing recommendations",
  "pricing.approve": "Approve discounts and exceptional pricing",
  "pricing.config": "Edit pricing slabs, catalogue and commercial rules",
  "quote.create": "Prepare quotations",
  "quote.send": "Mark approved quotations as sent",
  "competitor.view": "View competitor intelligence",
  "competitor.edit": "Edit competitor intelligence",
  "onboarding.view": "View customer onboarding",
  "onboarding.edit": "Update customer onboarding",
  "tasks.manage": "Create and assign tasks to others",
  // reporting
  "dashboard.founder": "Founder command centre & full analytics",
  "reports.view.all": "All reports and forecasts",
  "reports.view.team": "Team reports",
  "reports.export": "Export data (Excel/CSV)",
  "performance.view.all": "All salesperson performance",
  "performance.view.team": "Team performance",
  "performance.view.own": "Own performance",
  // administration
  "users.manage": "Create, edit, disable users and assign roles",
  "users.support": "Unlock accounts / reset passwords of non-admin users",
  "roles.manage": "Edit role permissions",
  "settings.business": "Edit business rules (scoring, stages, targets, taxonomy)",
  "settings.technical": "Edit technical settings (AI, email, backups)",
  "taxonomy.manage": "Maintain dropdown lists (talukas, types, activity types, lost reasons)",
  "expansion.manage": "Launch districts / states",
  "audit.view": "View the full audit log",
  "audit.view.technical": "View audit entries for configuration, users and permissions only",
  "grants.manage": "Grant time-boxed data access to technical staff",
  "cr.create": "Raise change requests",
  "cr.manage": "Review / implement change requests",
  "cr.approve": "Approve sensitive change requests",
  "tech.dashboard": "Technical health dashboard, logs, jobs, backups",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Only the Super Admin role may hold these. Role editing rejects attempts to grant them elsewhere. */
export const SUPER_ADMIN_ONLY: Permission[] = [
  "pricing.approve", "deal.edit_locked", "users.manage", "roles.manage", "audit.view",
  "grants.manage", "cr.approve", "dashboard.founder", "expansion.manage",
];

export const DEFAULT_ROLES: Record<string, { name: string; description: string; permissions: Permission[] }> = {
  SUPER_ADMIN: {
    name: "Super Admin (Founder/CEO)",
    description: "Complete business and system control. Owns all company data.",
    permissions: ALL_PERMISSIONS,
  },
  TECH_ADMIN: {
    name: "Technical Administrator",
    description: "Application health, configuration, backups, releases. No business decision authority; business data only via a time-boxed grant.",
    permissions: ["settings.technical", "taxonomy.manage", "tech.dashboard", "cr.create", "cr.manage", "users.support", "audit.view.technical"],
  },
  SALES_MANAGER: {
    name: "Sales Manager",
    description: "Team records, assignment, pipeline review, team reports.",
    permissions: ["lead.view.team", "lead.create", "lead.edit", "lead.assign", "research.edit", "contact.edit", "activity.create",
      "deal.view", "deal.create", "deal.edit", "pricing.view", "quote.create", "quote.send", "competitor.view", "onboarding.view",
      "tasks.manage", "reports.view.team", "performance.view.team", "cr.create"],
  },
  SALES_EXEC: {
    name: "Sales Executive",
    description: "Assigned leads, activities, stages, follow-ups, draft quotations, own performance.",
    permissions: ["lead.view.own", "lead.create", "lead.edit", "contact.edit", "activity.create", "deal.view", "deal.create", "deal.edit",
      "pricing.view", "quote.create", "competitor.view", "performance.view.own"],
  },
  RESEARCH_ANALYST: {
    name: "Research Analyst",
    description: "Adds and validates institutions, sources, evidence, vendors. No commercial pricing.",
    permissions: ["lead.view.all", "lead.create", "lead.edit", "lead.import", "research.edit", "contact.edit", "competitor.view", "competitor.edit"],
  },
};
