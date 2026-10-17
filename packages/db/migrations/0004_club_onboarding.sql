CREATE TYPE "public"."club_application_status" AS ENUM('draft', 'submitted', 'approved', 'declined', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."payments_interest" AS ENUM('yes', 'maybe', 'no');--> statement-breakpoint
CREATE TYPE "public"."photo_status" AS ENUM('pending', 'approved', 'declined');--> statement-breakpoint
CREATE TYPE "public"."rate_category" AS ENUM('green_fee', 'cart', 'club_hire', 'trolley', 'range', 'deal', 'membership', 'other');--> statement-breakpoint
CREATE TYPE "public"."rate_days" AS ENUM('any', 'weekday', 'weekend', 'public_holiday', 'custom');--> statement-breakpoint
CREATE TYPE "public"."rate_player" AS ENUM('any', 'adult', 'senior', 'concession', 'junior', 'student', 'member_guest');--> statement-breakpoint
CREATE TYPE "public"."rate_unit" AS ENUM('per_player', 'per_cart', 'per_set', 'per_group', 'per_item');--> statement-breakpoint
CREATE TABLE "club_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"status" "club_application_status" DEFAULT 'draft' NOT NULL,
	"resume_token_hash" text NOT NULL,
	"club_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"consents" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"payments_interest" "payments_interest",
	"club_id" uuid,
	"review_notes" text,
	CONSTRAINT "club_applications_resume_token_hash_unique" UNIQUE("resume_token_hash")
);
--> statement-breakpoint
CREATE TABLE "club_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"course_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "photo_status" DEFAULT 'pending' NOT NULL,
	"content_type" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"caption" text,
	"credit" text,
	"rights_confirmed_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid,
	"club_id" uuid,
	"course_name" text,
	"sort" smallint DEFAULT 0 NOT NULL,
	"category" "rate_category" NOT NULL,
	"name" text NOT NULL,
	"holes" smallint,
	"days" "rate_days" DEFAULT 'any' NOT NULL,
	"days_of_week" smallint[],
	"time_from" time,
	"time_to" time,
	"player" "rate_player" DEFAULT 'any' NOT NULL,
	"price_cents" integer NOT NULL,
	"unit" "rate_unit" DEFAULT 'per_player' NOT NULL,
	"gst_included" boolean DEFAULT true NOT NULL,
	"valid_from" date,
	"valid_to" date,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "club_applications" ADD CONSTRAINT "club_applications_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_photos" ADD CONSTRAINT "club_photos_application_id_club_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."club_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_photos" ADD CONSTRAINT "club_photos_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_rates" ADD CONSTRAINT "club_rates_application_id_club_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."club_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_rates" ADD CONSTRAINT "club_rates_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "club_applications_email_idx" ON "club_applications" USING btree ("contact_email","created_at");--> statement-breakpoint
CREATE INDEX "club_photos_application_idx" ON "club_photos" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "club_photos_course_idx" ON "club_photos" USING btree ("course_id","status");--> statement-breakpoint
CREATE INDEX "club_rates_application_idx" ON "club_rates" USING btree ("application_id","sort");