ALTER TABLE "institutions" ALTER COLUMN "type_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "institutions" ALTER COLUMN "district_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "authorized_person_name" text;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "authorized_person_designation" text;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "authorized_person_phone" text;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "authorized_person_email" text;