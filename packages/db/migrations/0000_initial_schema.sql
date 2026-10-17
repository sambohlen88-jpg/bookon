CREATE TYPE "public"."alert_status" AS ENUM('pending', 'active', 'paused', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."check_status" AS ENUM('ok', 'error');--> statement-breakpoint
CREATE TYPE "public"."click_source" AS ENUM('search', 'alert', 'directory');--> statement-breakpoint
CREATE TYPE "public"."contact_type" AS ENUM('email', 'push');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('miclub', 'quick18', 'chronogolf', 'manual');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"contact_type" "contact_type" NOT NULL,
	"contact_value" text NOT NULL,
	"filters" jsonb NOT NULL,
	"status" "alert_status" DEFAULT 'pending' NOT NULL,
	"manage_token" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"last_notified_at" timestamp with time zone,
	CONSTRAINT "alerts_manage_token_unique" UNIQUE("manage_token")
);
--> statement-breakpoint
CREATE TABLE "availability_checks" (
	"course_id" uuid NOT NULL,
	"play_date" date NOT NULL,
	"status" "check_status" NOT NULL,
	"last_attempt_at" timestamp with time zone NOT NULL,
	"last_success_at" timestamp with time zone,
	"tee_time_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	CONSTRAINT "availability_checks_course_id_play_date_pk" PRIMARY KEY("course_id","play_date")
);
--> statement-breakpoint
CREATE TABLE "availability_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"course_id" uuid NOT NULL,
	"play_date" date NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"holes" smallint NOT NULL,
	"layout" text,
	"spots_available" smallint NOT NULL,
	"min_players" smallint DEFAULT 1 NOT NULL,
	"price_cents" integer,
	"booking_url" text,
	"source_url" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "click_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"anonymous_session_id" text,
	"course_id" uuid NOT NULL,
	"start_time" timestamp with time zone,
	"source" "click_source" NOT NULL,
	"notification_id" uuid
);
--> statement-breakpoint
CREATE TABLE "club_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clubs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"contact_email" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clubs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"suburb" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"holes" smallint NOT NULL,
	"platform" "platform" NOT NULL,
	"platform_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"website_url" text NOT NULL,
	"booking_url" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"booking_window_days" smallint DEFAULT 7 NOT NULL,
	"typical_green_fee_cents" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "daily_impressions" (
	"course_id" uuid NOT NULL,
	"day" date NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_impressions_course_id_day_pk" PRIMARY KEY("course_id","day")
);
--> statement-breakpoint
CREATE TABLE "fetch_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"course_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "check_status",
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"tee_time_count" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"holes" smallint NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"channel" "contact_type" NOT NULL,
	"click_token" text NOT NULL,
	CONSTRAINT "notifications_click_token_unique" UNIQUE("click_token")
);
--> statement-breakpoint
CREATE TABLE "searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"anonymous_session_id" text NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"time_from" time NOT NULL,
	"time_to" time NOT NULL,
	"players" smallint NOT NULL,
	"holes" smallint,
	"course_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"result_count" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "availability_checks" ADD CONSTRAINT "availability_checks_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_snapshots" ADD CONSTRAINT "availability_snapshots_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_reports" ADD CONSTRAINT "club_reports_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_impressions" ADD CONSTRAINT "daily_impressions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fetch_runs" ADD CONSTRAINT "fetch_runs_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_course_date_idx" ON "availability_snapshots" USING btree ("course_id","play_date");--> statement-breakpoint
CREATE INDEX "availability_start_idx" ON "availability_snapshots" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "click_events_course_created_idx" ON "click_events" USING btree ("course_id","created_at");--> statement-breakpoint
CREATE INDEX "fetch_runs_course_started_idx" ON "fetch_runs" USING btree ("course_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_once_per_slot" ON "notifications" USING btree ("alert_id","course_id","start_time","holes");