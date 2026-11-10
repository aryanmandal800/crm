import { sql, SQL } from "drizzle-orm";
import { db } from "@/db";
import type { Ctx } from "./auth";
import { allSettings } from "./settings";
import { addDays, startOfDay } from "./format";

/** Owner filter: null = whole company (Super Admin / full reports), else a list of user ids (team / self). */
export function ownerFilter(ctx: Ctx): string[] | null {
  if (ctx.can("reports.view.all") || ctx.can("dashboard.founder")) return null;
  if (ctx.can("reports.view.team") || ctx.can("performance.view.team")) return ctx.teamUserIds;
  return [ctx.user.id];
}
const UUID = /^[0-9a-f-]{36}$/i;
const inOwners = (col: SQL, raw: string[] | null, includeNull = false): SQL => {
  const ids = raw?.filter((x) => UUID.test(x)) ?? null;
  if (ids && !ids.length) return includeNull ? sql`${col} is null` : sql`false`;
  return ids == null ? sql`true` : includeNull ? sql`(${col} = any(${sql.raw(`'{${ids.join(",")}}'::uuid[]`)}) or ${col} is null)` : sql`${col} = any(${sql.raw(`'{${ids.join(",")}}'::uuid[]`)})`;
};

async function q<T>(query: SQL): Promise<T[]> { return (await db.execute(query)).rows as T[]; }
const n = (v: any) => Number(v ?? 0);

export async function leadKpis(owners: string[] | null) {
  const s = await allSettings();
  const [r] = await q<any>(sql`
    select count(*) filter (where it.is_primary) as prospects, count(*) filter (where not it.is_primary) as expansion,
      count(*) filter (where it.is_primary and i.verification = 'VERIFIED') as verified, count(*) filter (where it.is_primary and i.verification <> 'VERIFIED') as unverified,
      count(*) filter (where it.is_primary and i.score_band = 'HOT') as hot, count(*) filter (where it.is_primary and i.score_band = 'WARM') as warm,
      count(*) filter (where it.is_primary and i.score_band = 'NURTURE') as nurture, count(*) filter (where it.is_primary and i.score_band = 'LOW') as low,
      coalesce(sum(coalesce(i.active_members, i.total_members)) filter (where it.is_primary), 0) as members,
      coalesce(sum(i.branch_count) filter (where it.is_primary), 0) as branches,
      count(*) filter (where it.is_primary and i.total_members is not null) as with_members,
      count(*) filter (where i.owner_id is null) as unassigned
    from institutions i join institution_types it on it.id = i.type_id where i.deleted_at is null and ${inOwners(sql`i.owner_id`, owners, true)}`);
  const listRate = Number(s.get("pricing.listRate")), floor = Number(s.get("pricing.floorRate"));
  const members = n(r.members);
  return { prospects: n(r.prospects), expansion: n(r.expansion), verified: n(r.verified), unverified: n(r.unverified), hot: n(r.hot), warm: n(r.warm), nurture: n(r.nurture), low: n(r.low),
    members, branches: n(r.branches), withMembers: n(r.with_members), unassigned: n(r.unassigned),
    mrrOpportunityList: members * listRate, mrrOpportunityFloor: members * floor, acvOpportunity: members * listRate * 12 };
}

export async function pipelineKpis(owners: string[] | null) {
  const [r] = await q<any>(sql`
    select count(*) filter (where s.is_open) as open, count(*) filter (where s.is_won) as won, count(*) filter (where s.is_lost) as lost,
      coalesce(sum(d.mrr) filter (where s.is_open), 0) as open_mrr, coalesce(sum(d.mrr * coalesce(d.probability_override, s.probability) / 100.0) filter (where s.is_open), 0) as weighted_mrr,
      coalesce(sum(d.mrr) filter (where s.is_won), 0) as won_mrr, coalesce(sum(d.mrr) filter (where s.is_won and d.won_at >= date_trunc('month', now())), 0) as won_mrr_month,
      count(distinct d.institution_id) filter (where s.is_qualified) as qualified,
      count(*) filter (where s.key = 'DISCOVERY') as discovery, count(*) filter (where s.key = 'DEMO') as demo, count(*) filter (where s.key = 'PROPOSAL') as proposal,
      count(*) filter (where s.key = 'NEGOTIATION') as negotiation, count(*) filter (where s.key in ('PILOT_PROPOSED','PILOT_ACTIVE')) as pilots,
      count(*) filter (where s.key = 'PILOT_ACTIVE') as pilots_active,
      count(*) filter (where s.is_open and d.follow_up_date < date_trunc('day', now())) as overdue,
      count(*) filter (where s.is_open and d.stage_changed_at < now() - (s.stall_days || ' days')::interval) as stalled
    from deals d join pipeline_stages s on s.id = d.stage_id where ${inOwners(sql`d.owner_id`, owners)}`);
  const won = n(r.won), lost = n(r.lost);
  return { open: n(r.open), won, lost, openMrr: n(r.open_mrr), weightedMrr: n(r.weighted_mrr), wonMrr: n(r.won_mrr), wonMrrMonth: n(r.won_mrr_month), qualified: n(r.qualified),
    discovery: n(r.discovery), demo: n(r.demo), proposal: n(r.proposal), negotiation: n(r.negotiation), pilots: n(r.pilots), pilotsActive: n(r.pilots_active),
    overdue: n(r.overdue), stalled: n(r.stalled), winRate: won + lost ? Math.round((won / (won + lost)) * 100) : null };
}

export async function activityKpis(owners: string[] | null, since: Date) {
  const [r] = await q<any>(sql`
    select count(*) filter (where at.counts_as_call) as calls, count(*) filter (where a.decision_maker_reached) as dms, count(*) filter (where a.meaningful) as meaningful,
      count(*) filter (where a.type_key = 'MEETING') as meetings, count(*) filter (where a.type_key = 'DEMO') as demos, count(*) as total
    from activities a left join activity_types at on at.key = a.type_key
    where a.status = 'DONE' and a.occurred_at >= ${since.toISOString()} and ${inOwners(sql`a.user_id`, owners)}`);
  return { calls: n(r.calls), dms: n(r.dms), meaningful: n(r.meaningful), meetings: n(r.meetings), demos: n(r.demos), total: n(r.total) };
}

export async function stageFunnel(owners: string[] | null) {
  return (await q<any>(sql`select s.id, s.key, s.name, s.sort_order, count(d.id) as n, coalesce(sum(d.mrr),0) as mrr from pipeline_stages s
    left join deals d on d.stage_id = s.id and ${inOwners(sql`d.owner_id`, owners)} where s.active group by s.id order by s.sort_order`))
    .map((r) => ({ id: r.id, key: r.key, name: r.name, n: n(r.n), mrr: n(r.mrr) }));
}

export async function talukaCoverage(owners: string[] | null) {
  return (await q<any>(sql`
    select tk.id, tk.name, count(i.id) filter (where it.is_primary) as institutions,
      count(i.id) filter (where it.is_primary and exists (select 1 from activities a where a.institution_id = i.id)) as contacted,
      count(i.id) filter (where it.is_primary and i.score_band in ('HOT','WARM')) as hot_warm,
      (select count(*) from deals d join pipeline_stages s on s.id = d.stage_id join institutions i2 on i2.id = d.institution_id where i2.taluka_id = tk.id and s.is_open and ${inOwners(sql`d.owner_id`, owners)}) as open_deals,
      (select coalesce(sum(d.mrr),0) from deals d join pipeline_stages s on s.id = d.stage_id join institutions i2 on i2.id = d.institution_id where i2.taluka_id = tk.id and s.is_open and ${inOwners(sql`d.owner_id`, owners)}) as open_mrr
    from talukas tk left join institutions i on i.taluka_id = tk.id and i.deleted_at is null and ${inOwners(sql`i.owner_id`, owners, true)}
    left join institution_types it on it.id = i.type_id where tk.active group by tk.id order by tk.name`))
    .map((r) => ({ id: r.id, name: r.name, institutions: n(r.institutions), contacted: n(r.contacted), hotWarm: n(r.hot_warm), openDeals: n(r.open_deals), openMrr: n(r.open_mrr),
      coverage: n(r.institutions) ? Math.round((n(r.contacted) / n(r.institutions)) * 100) : 0 }));
}

export async function typePipeline(owners: string[] | null) {
  return (await q<any>(sql`
    select it.id, it.name, it.is_primary, count(distinct i.id) as institutions, count(d.id) filter (where s.is_open) as open_deals, coalesce(sum(d.mrr) filter (where s.is_open),0) as open_mrr
    from institution_types it left join institutions i on i.type_id = it.id and i.deleted_at is null and ${inOwners(sql`i.owner_id`, owners, true)}
    left join deals d on d.institution_id = i.id left join pipeline_stages s on s.id = d.stage_id
    where it.active group by it.id order by it.sort_order`)).map((r) => ({ id: r.id, name: r.name, primary: r.is_primary, institutions: n(r.institutions), openDeals: n(r.open_deals), openMrr: n(r.open_mrr) }));
}

export async function salesPerformance(owners: string[] | null, since: Date) {
  const iso = since.toISOString();
  return (await q<any>(sql`
    select u.id, u.name, r.name as role,
      (select count(*) from institutions i where i.owner_id = u.id and i.deleted_at is null) as leads,
      (select count(*) from institutions i where i.researched_by_id = u.id and i.verification <> 'UNVERIFIED') as researched,
      (select count(*) from activities a join activity_types at on at.key = a.type_key where a.user_id = u.id and a.status = 'DONE' and at.counts_as_call and a.occurred_at >= ${iso}) as calls,
      (select count(*) from activities a where a.user_id = u.id and a.meaningful and a.occurred_at >= ${iso}) as meaningful,
      (select count(*) from activities a where a.user_id = u.id and a.decision_maker_reached and a.occurred_at >= ${iso}) as dms,
      (select count(*) from activities a where a.user_id = u.id and a.status = 'DONE' and a.type_key = 'MEETING' and a.occurred_at >= ${iso}) as meetings,
      (select count(*) from activities a where a.user_id = u.id and a.status = 'DONE' and a.type_key = 'DEMO' and a.occurred_at >= ${iso}) as demos,
      (select count(*) from quotes qt where qt.created_by_id = u.id and qt.created_at >= ${iso}) as proposals,
      (select count(*) from deals d join pipeline_stages s on s.id = d.stage_id where d.owner_id = u.id and s.key in ('PILOT_PROPOSED','PILOT_ACTIVE')) as pilots,
      (select count(*) from deals d where d.owner_id = u.id and d.won_at >= ${iso}) as won,
      (select coalesce(sum(d.mrr),0) from deals d where d.owner_id = u.id and d.won_at is not null) as won_mrr,
      (select count(*) from deals d where d.owner_id = u.id and d.lost_at >= ${iso}) as lost,
      (select count(*) from deals d join pipeline_stages s on s.id = d.stage_id where d.owner_id = u.id and s.is_open) as open_deals,
      (select count(*) from deals d join pipeline_stages s on s.id = d.stage_id where d.owner_id = u.id and s.is_open and (d.follow_up_date is null or d.follow_up_date < date_trunc('day', now()))) as overdue
    from users u join roles r on r.id = u.role_id
    where u.active and r.key not in ('TECH_ADMIN') and ${inOwners(sql`u.id`, owners)} order by u.name`)).map((r) => {
      const won = n(r.won), lost = n(r.lost), open = n(r.open_deals), overdue = n(r.overdue);
      return { id: r.id, name: r.name, role: r.role, leads: n(r.leads), researched: n(r.researched), calls: n(r.calls), meaningful: n(r.meaningful), dms: n(r.dms), meetings: n(r.meetings),
        demos: n(r.demos), proposals: n(r.proposals), pilots: n(r.pilots), won, wonMrr: n(r.won_mrr), conversion: won + lost ? Math.round((won / (won + lost)) * 100) : null,
        followUpDiscipline: open ? Math.round(((open - overdue) / open) * 100) : null, openDeals: open, overdue };
    });
}

export async function topOpportunities(owners: string[] | null, limit = 20) {
  return (await q<any>(sql`
    select i.id, i.legal_name, i.score, i.score_band, i.opportunity_category, coalesce(i.active_members, i.total_members) as members, i.branch_count,
      u.name as owner, d.id as deal_id, s.name as stage, d.mrr, d.follow_up_date
    from institutions i left join users u on u.id = i.owner_id
    left join lateral (select d.* from deals d join pipeline_stages s2 on s2.id = d.stage_id where d.institution_id = i.id and s2.is_open order by d.mrr desc limit 1) d on true
    left join pipeline_stages s on s.id = d.stage_id
    where i.deleted_at is null and ${inOwners(sql`i.owner_id`, owners, true)} and i.score_band in ('HOT','WARM')
    order by i.score desc, d.mrr desc nulls last limit ${limit}`)).map((r) => ({ ...r, mrr: r.mrr == null ? null : n(r.mrr), members: r.members == null ? null : n(r.members) }));
}

export async function dealLists(owners: string[] | null) {
  const base = sql`from deals d join pipeline_stages s on s.id = d.stage_id join institutions i on i.id = d.institution_id join users u on u.id = d.owner_id where ${inOwners(sql`d.owner_id`, owners)}`;
  const cols = sql`d.id, d.title, i.legal_name as inst, i.score_band as band, i.score, s.name as stage, u.name as owner, d.mrr, d.follow_up_date, d.next_action, d.stage_changed_at, d.founder_flag_reason`;
  const [overdue, stalled, founder] = await Promise.all([
    q<any>(sql`select ${cols} ${base} and s.is_open and (d.follow_up_date is null or d.follow_up_date < date_trunc('day', now())) order by d.follow_up_date nulls first limit 50`),
    q<any>(sql`select ${cols} ${base} and s.is_open and d.stage_changed_at < now() - (s.stall_days || ' days')::interval order by d.stage_changed_at limit 50`),
    q<any>(sql`select ${cols} ${base} and s.is_open and (d.founder_flag or (s.key in ('NEGOTIATION','MGMT_APPROVAL','CONTRACT_PENDING') and i.score_band = 'HOT')) order by d.mrr desc limit 30`),
  ]);
  return { overdue, stalled, founder };
}

/** Hot leads at risk: no activity in N days, overdue follow-up or stalled. */
export async function hotAtRisk(owners: string[] | null) {
  const days = Number((await allSettings()).get("sales.noContactDays"));
  return q<any>(sql`
    select i.id, i.legal_name, i.score, u.name as owner,
      (select max(a.occurred_at) from activities a where a.institution_id = i.id and a.status = 'DONE') as last_touch
    from institutions i left join users u on u.id = i.owner_id
    where i.deleted_at is null and i.score_band = 'HOT' and ${inOwners(sql`i.owner_id`, owners, true)}
      and (not exists (select 1 from activities a where a.institution_id = i.id and a.status = 'DONE' and a.occurred_at > now() - (${days} || ' days')::interval)
        or exists (select 1 from deals d join pipeline_stages s on s.id = d.stage_id where d.institution_id = i.id and s.is_open and d.follow_up_date < date_trunc('day', now())))
    order by i.score desc limit 30`);
}

export async function tomorrowActions(owners: string[] | null) {
  const end = addDays(startOfDay(), 2).toISOString();
  const deals = await q<any>(sql`
    select d.id, i.legal_name as inst, d.next_action, d.follow_up_date, u.name as owner, i.score, d.mrr, coalesce(d.probability_override, s.probability) as prob, s.name as stage
    from deals d join pipeline_stages s on s.id = d.stage_id join institutions i on i.id = d.institution_id join users u on u.id = d.owner_id
    where s.is_open and d.follow_up_date < ${end} and ${inOwners(sql`d.owner_id`, owners)}`);
  const approvals = owners == null ? await q<any>(sql`select id, summary from approval_requests where status = 'PENDING' order by created_at limit 5`) : [];
  const actions = [
    ...approvals.map((a) => ({ priority: 1e9, text: `Decide approval: ${a.summary}`, link: "/approvals", who: "Founder" })),
    ...deals.map((d) => ({ priority: n(d.mrr) * (n(d.prob) / 100 + 0.1) + n(d.score) * 50 + (new Date(d.follow_up_date) < startOfDay() ? 5000 : 0),
      text: `${d.inst}: ${d.next_action ?? "follow up"} (${d.stage})`, link: `/deals/${d.id}`, who: d.owner })),
  ];
  return actions.sort((a, b) => b.priority - a.priority).slice(0, 5);
}

export async function todayBySalesperson(owners: string[] | null) {
  const since = startOfDay().toISOString();
  return q<any>(sql`
    select u.id, u.name, count(a.id) filter (where a.status = 'DONE') as done, count(a.id) filter (where a.type_key = 'CALL' and a.status = 'DONE') as calls,
      count(a.id) filter (where a.decision_maker_reached) as dms, count(a.id) filter (where a.type_key in ('MEETING','DEMO') and a.status = 'DONE') as meetings,
      string_agg(distinct i.legal_name, ', ') filter (where a.status = 'DONE') as institutions
    from users u join roles r on r.id = u.role_id left join activities a on a.user_id = u.id and a.occurred_at >= ${since} left join institutions i on i.id = a.institution_id
    where u.active and r.key in ('SALES_EXEC','SALES_MANAGER','BDM') and ${inOwners(sql`u.id`, owners)} group by u.id order by u.name`);
}
