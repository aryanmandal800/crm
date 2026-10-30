CREATE TYPE "public"."confidence" AS ENUM('LOW', 'MEDIUM', 'HIGH');--> statement-breakpoint
CREATE TYPE "public"."contact_role" AS ENUM('CHAIRMAN', 'VICE_CHAIRMAN', 'SECRETARY', 'CEO_MD', 'GENERAL_MANAGER', 'IT_MANAGER', 'FINANCE_HEAD', 'DIRECTOR', 'BRANCH_MANAGER', 'INFLUENCER', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."fact_class" AS ENUM('VERIFIED_FACT', 'PUBLICLY_REPORTED', 'ESTIMATE');--> statement-breakpoint
CREATE TYPE "public"."hosting" AS ENUM('CLOUD', 'ON_PREMISE', 'HYBRID', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."inst_status" AS ENUM('ACTIVE', 'INACTIVE', 'UNDER_LIQUIDATION', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."tri_state" AS ENUM('YES', 'NO', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."vendor_class" AS ENUM('CONFIRMED_INCUMBENT', 'PROBABLE_INCUMBENT', 'UNKNOWN', 'NONE_IDENTIFIED');--> statement-breakpoint
CREATE TYPE "public"."verification" AS ENUM('UNVERIFIED', 'PARTIAL', 'VERIFIED', 'DISPUTED');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"deal_id" uuid,
	"contact_id" uuid,
	"user_id" uuid NOT NULL,
	"type_key" text NOT NULL,
	"status" text DEFAULT 'DONE' NOT NULL,
	"outcome" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"objection" text,
	"feedback" text,
	"next_action" text,
	"follow_up_date" timestamp with time zone,
	"decision_maker_reached" boolean DEFAULT false NOT NULL,
	"meaningful" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"counts_as_call" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "activity_types_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"summary" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"requested_by_id" uuid NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"decided_by_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"actor_name" text,
	"actor_role" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"ip" text
);
--> statement-breakpoint
CREATE TABLE "backups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'RUNNING' NOT NULL,
	"file" text,
	"size_bytes" bigint,
	"error" text,
	"trigger" text DEFAULT 'SCHEDULED' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"requested_by_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"business_reason" text,
	"priority" text DEFAULT 'MEDIUM' NOT NULL,
	"category" text NOT NULL,
	"assigned_to_id" uuid,
	"proposed_solution" text,
	"approval_required" boolean DEFAULT false NOT NULL,
	"approval_status" text DEFAULT 'NOT_REQUIRED' NOT NULL,
	"status" text DEFAULT 'REQUESTED' NOT NULL,
	"testing_status" text DEFAULT 'NOT_STARTED' NOT NULL,
	"completed_at" timestamp with time zone,
	"change_notes" text,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "change_requests_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "competitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"product" text,
	"website" text,
	"features" text,
	"target_segment" text,
	"public_pricing" text,
	"verified_customers" text,
	"strengths" text,
	"weaknesses" text,
	"differentiation" text,
	"positioning" text,
	"verification" "verification" DEFAULT 'UNVERIFIED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitors_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" "contact_role" DEFAULT 'OTHER' NOT NULL,
	"designation" text,
	"is_decision_maker" boolean DEFAULT false NOT NULL,
	"is_final_approver" boolean DEFAULT false NOT NULL,
	"is_champion" boolean DEFAULT false NOT NULL,
	"is_influencer" boolean DEFAULT false NOT NULL,
	"business_phone" text,
	"business_email" text,
	"linkedin_url" text,
	"verification" "verification" DEFAULT 'UNVERIFIED' NOT NULL,
	"relationship_strength" integer DEFAULT 0 NOT NULL,
	"source_url" text,
	"notes" text,
	"last_met_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"granted_by_id" uuid NOT NULL,
	"scope" text DEFAULT 'READ' NOT NULL,
	"reason" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"from_stage" text,
	"to_stage" text NOT NULL,
	"changed_by_id" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"title" text NOT NULL,
	"stage_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"opportunity_category" text DEFAULT 'GREENFIELD_CBS' NOT NULL,
	"modules" text[] DEFAULT '{}'::text[] NOT NULL,
	"members" integer,
	"branches" integer,
	"mrr" numeric(18, 2) DEFAULT 0 NOT NULL,
	"implementation_fee" numeric(18, 2) DEFAULT 0 NOT NULL,
	"probability_override" integer,
	"expected_close_date" timestamp with time zone,
	"next_action" text,
	"follow_up_date" timestamp with time zone,
	"founder_flag" boolean DEFAULT false NOT NULL,
	"founder_flag_reason" text,
	"lost_reason_id" uuid,
	"lost_notes" text,
	"competitor_id" uuid,
	"stage_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"won_at" timestamp with time zone,
	"lost_at" timestamp with time zone,
	"financials_locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "districts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"state" text DEFAULT 'Maharashtra' NOT NULL,
	"code" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"launched" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "error_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"route" text,
	"method" text,
	"status" integer,
	"message" text NOT NULL,
	"stack" text,
	"user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "institution_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "institution_types_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_code" text NOT NULL,
	"legal_name" text NOT NULL,
	"short_name" text,
	"type_id" uuid NOT NULL,
	"reg_number" text,
	"reg_date" timestamp with time zone,
	"reg_authority" text,
	"multi_state" boolean,
	"status" "inst_status" DEFAULT 'UNKNOWN' NOT NULL,
	"address" text,
	"district_id" uuid NOT NULL,
	"taluka_id" uuid,
	"city" text,
	"pin_code" text,
	"branch_count" integer,
	"branch_locations" text,
	"website" text,
	"maps_url" text,
	"social_profiles" text,
	"landline" text,
	"mobile" text,
	"email" text,
	"contact_page_url" text,
	"contact_verification" "verification" DEFAULT 'UNVERIFIED' NOT NULL,
	"total_members" integer,
	"active_members" integer,
	"total_deposits" numeric(18, 2),
	"loan_book" numeric(18, 2),
	"total_assets" numeric(18, 2),
	"annual_income" numeric(18, 2),
	"annual_profit" numeric(18, 2),
	"net_worth" numeric(18, 2),
	"employee_count" integer,
	"txn_volume" text,
	"financial_year" text,
	"financial_source" text,
	"financial_confidence" "confidence",
	"cbs_vendor" text,
	"cbs_product" text,
	"vendor_website" text,
	"hosting" "hosting" DEFAULT 'UNKNOWN' NOT NULL,
	"vendor_class" "vendor_class" DEFAULT 'UNKNOWN' NOT NULL,
	"mobile_app" "tri_state" DEFAULT 'UNKNOWN' NOT NULL,
	"internet_banking" "tri_state" DEFAULT 'UNKNOWN' NOT NULL,
	"upi_integration" "tri_state" DEFAULT 'UNKNOWN' NOT NULL,
	"digital_loans" "tri_state" DEFAULT 'UNKNOWN' NOT NULL,
	"ekyc" "tri_state" DEFAULT 'UNKNOWN' NOT NULL,
	"centralised_cbs" "tri_state" DEFAULT 'UNKNOWN' NOT NULL,
	"member_digital_services" text,
	"recent_tech_procurement" text,
	"contract_renewal" text,
	"legacy_evidence" text,
	"tech_complaints" text,
	"verification" "verification" DEFAULT 'UNVERIFIED' NOT NULL,
	"data_confidence" "confidence" DEFAULT 'LOW' NOT NULL,
	"fact_status" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"qualification" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"manual_scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_verified_at" timestamp with time zone,
	"next_verification_at" timestamp with time zone,
	"shariah_interest" boolean DEFAULT false NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"notes" text,
	"score" integer DEFAULT 0 NOT NULL,
	"score_band" text DEFAULT 'LOW' NOT NULL,
	"score_breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"missing_info" text[] DEFAULT '{}'::text[] NOT NULL,
	"opportunity_category" text DEFAULT 'NOT_QUALIFIED' NOT NULL,
	"insights" jsonb,
	"insights_at" timestamp with time zone,
	"insights_source" text,
	"scored_at" timestamp with time zone,
	"owner_id" uuid,
	"researched_by_id" uuid,
	"dedupe_key" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "institutions_lead_code_unique" UNIQUE("lead_code")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"last_error" text,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lost_reasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "lost_reasons_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"channel" text DEFAULT 'IN_APP' NOT NULL,
	"delivery" text DEFAULT 'DELIVERED' NOT NULL,
	"error" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboardings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"institution_id" uuid NOT NULL,
	"owner_id" uuid,
	"status" text DEFAULT 'IN_PROGRESS' NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"contract_value" numeric(18, 2) DEFAULT 0 NOT NULL,
	"advance_received" numeric(18, 2) DEFAULT 0 NOT NULL,
	"outstanding_amount" numeric(18, 2) DEFAULT 0 NOT NULL,
	"go_live_date" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboardings_deal_id_unique" UNIQUE("deal_id")
);
--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL,
	"probability" integer DEFAULT 0 NOT NULL,
	"is_open" boolean DEFAULT true NOT NULL,
	"is_won" boolean DEFAULT false NOT NULL,
	"is_lost" boolean DEFAULT false NOT NULL,
	"is_qualified" boolean DEFAULT false NOT NULL,
	"stall_days" integer DEFAULT 14 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "pipeline_stages_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "pricing_slabs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"min_members" integer NOT NULL,
	"max_members" integer,
	"rate_per_member" numeric(8, 2) NOT NULL,
	"label" text
);
--> statement-breakpoint
CREATE TABLE "product_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'CORE' NOT NULL,
	"pricing_type" text DEFAULT 'INCLUDED' NOT NULL,
	"price" numeric(18, 2) DEFAULT 0 NOT NULL,
	"is_core" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	CONSTRAINT "product_modules_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "qualification_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"serial" integer NOT NULL,
	"institution_id" uuid NOT NULL,
	"deal_id" uuid,
	"created_by_id" uuid NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"model" text DEFAULT 'MEMBER' NOT NULL,
	"members" integer DEFAULT 0 NOT NULL,
	"branches" integer DEFAULT 1 NOT NULL,
	"modules" text[] DEFAULT '{}'::text[] NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scope" text,
	"rate_per_member" numeric(8, 2) DEFAULT 0 NOT NULL,
	"monthly_fee" numeric(18, 2) DEFAULT 0 NOT NULL,
	"implementation_fee" numeric(18, 2) DEFAULT 0 NOT NULL,
	"migration_fee" numeric(18, 2) DEFAULT 0 NOT NULL,
	"discount_pct" numeric(5, 2) DEFAULT 0 NOT NULL,
	"gst_rate" numeric(5, 2) DEFAULT 18 NOT NULL,
	"terms" text,
	"milestones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"valid_until" timestamp with time zone,
	"approved_by_id" uuid,
	"approved_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_number_unique" UNIQUE("number"),
	CONSTRAINT "quotes_serial_unique" UNIQUE("serial")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"permissions" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "scoring_parameters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"max_score" integer NOT NULL,
	"kind" text DEFAULT 'BUILTIN' NOT NULL,
	"guidance" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "scoring_parameters_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"category" text NOT NULL,
	"label" text,
	"description" text,
	"owner_role" text DEFAULT 'SUPER_ADMIN' NOT NULL,
	"updated_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"evidence_url" text,
	"signal_date" timestamp with time zone,
	"strength" "confidence" DEFAULT 'MEDIUM' NOT NULL,
	"confidence" "confidence" DEFAULT 'MEDIUM' NOT NULL,
	"recommended_action" text,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid,
	"competitor_id" uuid,
	"name" text NOT NULL,
	"url" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"evidence" text,
	"field_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"classification" "fact_class" DEFAULT 'PUBLICLY_REPORTED' NOT NULL,
	"verification" "verification" DEFAULT 'UNVERIFIED' NOT NULL,
	"confidence" "confidence" DEFAULT 'MEDIUM' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"next_verification_at" timestamp with time zone,
	"notes" text,
	"added_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "talukas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"notes" text,
	"district_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period" text NOT NULL,
	"metric" text NOT NULL,
	"value" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"assignee_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"institution_id" uuid,
	"deal_id" uuid,
	"due_at" timestamp with time zone,
	"priority" text DEFAULT 'MEDIUM' NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"region" text,
	"manager_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"role_id" uuid NOT NULL,
	"team_id" uuid,
	"is_founder" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_access_grants" ADD CONSTRAINT "data_access_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_access_grants" ADD CONSTRAINT "data_access_grants_granted_by_id_users_id_fk" FOREIGN KEY ("granted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_history" ADD CONSTRAINT "deal_stage_history_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_history" ADD CONSTRAINT "deal_stage_history_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_lost_reason_id_lost_reasons_id_fk" FOREIGN KEY ("lost_reason_id") REFERENCES "public"."lost_reasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_type_id_institution_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."institution_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_taluka_id_talukas_id_fk" FOREIGN KEY ("taluka_id") REFERENCES "public"."talukas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_researched_by_id_users_id_fk" FOREIGN KEY ("researched_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboardings" ADD CONSTRAINT "onboardings_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboardings" ADD CONSTRAINT "onboardings_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboardings" ADD CONSTRAINT "onboardings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_added_by_id_users_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talukas" ADD CONSTRAINT "talukas_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "act_user_time" ON "activities" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "act_inst" ON "activities" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "approvals_status" ON "approval_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_entity" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_at" ON "audit_logs" USING btree ("at");--> statement-breakpoint
CREATE INDEX "contacts_inst" ON "contacts" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "deals_stage" ON "deals" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "deals_owner" ON "deals" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "deals_inst" ON "deals" USING btree ("institution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "districts_name_state" ON "districts" USING btree ("name","state");--> statement-breakpoint
CREATE INDEX "inst_geo" ON "institutions" USING btree ("district_id","taluka_id");--> statement-breakpoint
CREATE INDEX "inst_type" ON "institutions" USING btree ("type_id");--> statement-breakpoint
CREATE INDEX "inst_owner" ON "institutions" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "inst_band" ON "institutions" USING btree ("score_band");--> statement-breakpoint
CREATE INDEX "inst_dedupe" ON "institutions" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "inst_reg" ON "institutions" USING btree ("reg_number");--> statement-breakpoint
CREATE INDEX "jobs_status_run" ON "jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE INDEX "notif_user" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "signals_inst" ON "signals" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "sources_inst" ON "sources" USING btree ("institution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "talukas_district_name" ON "talukas" USING btree ("district_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "targets_unique" ON "targets" USING btree ("user_id","period","metric");