CREATE TYPE "public"."event_entry_status" AS ENUM('checkout', 'paid', 'withdrawn', 'cancelled', 'abandoned');--> statement-breakpoint
CREATE TABLE "event_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"status" "event_entry_status" DEFAULT 'checkout' NOT NULL,
	"players" jsonb NOT NULL,
	"player_count" smallint NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text NOT NULL,
	"note" text,
	"user_id" uuid,
	"fees_cents" integer NOT NULL,
	"booking_fee_cents" integer NOT NULL,
	"manage_token" text NOT NULL,
	"provider" text NOT NULL,
	"checkout_id" text,
	"checkout_expires_at" timestamp with time zone NOT NULL,
	"payment_id" text,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" text,
	"refund_cents" integer DEFAULT 0 NOT NULL,
	"start_group" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_entries_manage_token_unique" UNIQUE("manage_token")
);
--> statement-breakpoint
CREATE TABLE "event_waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"players" smallint NOT NULL,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"date" date NOT NULL,
	"holes" smallint NOT NULL,
	"start_type" text NOT NULL,
	"first_start" timestamp with time zone NOT NULL,
	"interval_minutes" smallint DEFAULT 10 NOT NULL,
	"two_tees" boolean DEFAULT false NOT NULL,
	"team_size" smallint NOT NULL,
	"fee_cents" integer NOT NULL,
	"member_fee_cents" integer,
	"max_players" smallint NOT NULL,
	"entries_close" timestamp with time zone NOT NULL,
	"open" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancel_note" text,
	"start_sheet_published_at" timestamp with time zone,
	"results" text,
	"results_at" timestamp with time zone,
	"closed_notice_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "payment_account_id" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "payments_ready" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "event_terms" jsonb;--> statement-breakpoint
ALTER TABLE "event_entries" ADD CONSTRAINT "event_entries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_entries" ADD CONSTRAINT "event_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_waitlist" ADD CONSTRAINT "event_waitlist_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_entries_event_idx" ON "event_entries" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_entries_email_idx" ON "event_entries" USING btree ("contact_email");--> statement-breakpoint
CREATE INDEX "event_entries_status_idx" ON "event_entries" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "event_waitlist_event_email_idx" ON "event_waitlist" USING btree ("event_id","email");--> statement-breakpoint
CREATE INDEX "events_club_idx" ON "events" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "events_status_date_idx" ON "events" USING btree ("status","date");