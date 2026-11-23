CREATE TABLE IF NOT EXISTS "user_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_version" integer NOT NULL DEFAULT 0,
  "login_at" timestamp with time zone NOT NULL DEFAULT now(),
  "logout_at" timestamp with time zone,
  "last_active_at" timestamp with time zone NOT NULL DEFAULT now(),
  "duration_seconds" integer NOT NULL DEFAULT 0,
  "ip" text,
  "city" text,
  "region" text,
  "country" text DEFAULT 'India',
  "postal_code" text,
  "isp" text,
  "address" text,
  "latitude" numeric,
  "longitude" numeric,
  "device_type" text DEFAULT 'Desktop',
  "browser" text,
  "os" text,
  "user_agent" text,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_sessions_user_login" ON "user_sessions"("user_id", "login_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_sessions_status" ON "user_sessions"("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_sessions_last_active" ON "user_sessions"("last_active_at" DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_activity_logs" (
  "id" bigserial PRIMARY KEY,
  "session_id" uuid REFERENCES "user_sessions"("id") ON DELETE SET NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "user_name" text NOT NULL,
  "user_email" text NOT NULL,
  "role_key" text NOT NULL,
  "activity_type" text NOT NULL,
  "title" text NOT NULL,
  "route" text,
  "entity_type" text,
  "entity_id" text,
  "details" jsonb DEFAULT '{}'::jsonb,
  "ip" text,
  "location" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_activity_user_time" ON "user_activity_logs"("user_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_activity_session" ON "user_activity_logs"("session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_activity_type" ON "user_activity_logs"("activity_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_activity_created" ON "user_activity_logs"("created_at" DESC);
