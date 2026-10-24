CREATE TYPE "public"."matchplay_entry_status" AS ENUM('checkout', 'entered', 'withdrawn', 'cancelled', 'abandoned');--> statement-breakpoint
CREATE TABLE "matchplay_comps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"team_size" smallint NOT NULL,
	"online_entry" boolean DEFAULT true NOT NULL,
	"fee_cents" integer DEFAULT 0 NOT NULL,
	"max_entries" smallint NOT NULL,
	"entries_close" timestamp with time zone,
	"open" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'entries' NOT NULL,
	"rounds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"draw_size" smallint,
	"published_at" timestamp with time zone,
	"winner_entry_id" uuid,
	"cancelled_at" timestamp with time zone,
	"cancel_note" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matchplay_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comp_id" uuid NOT NULL,
	"status" "matchplay_entry_status" DEFAULT 'entered' NOT NULL,
	"players" jsonb NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"source" text NOT NULL,
	"user_id" uuid,
	"seed" smallint,
	"fees_cents" integer DEFAULT 0 NOT NULL,
	"booking_fee_cents" integer DEFAULT 0 NOT NULL,
	"manage_token" text NOT NULL,
	"provider" text,
	"checkout_id" text,
	"checkout_expires_at" timestamp with time zone,
	"payment_id" text,
	"entered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" text,
	"refund_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matchplay_entries_manage_token_unique" UNIQUE("manage_token")
);
--> statement-breakpoint
CREATE TABLE "matchplay_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comp_id" uuid NOT NULL,
	"round" smallint NOT NULL,
	"slot" smallint NOT NULL,
	"entry_a" uuid,
	"entry_b" uuid,
	"status" text DEFAULT 'waiting' NOT NULL,
	"winner_entry_id" uuid,
	"score" text,
	"reported_by" uuid,
	"reported_at" timestamp with time zone,
	"dispute_by" timestamp with time zone,
	"dispute_note" text,
	"decided_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"overdue_notice_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "matchplay_comps" ADD CONSTRAINT "matchplay_comps_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchplay_comps" ADD CONSTRAINT "matchplay_comps_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchplay_entries" ADD CONSTRAINT "matchplay_entries_comp_id_matchplay_comps_id_fk" FOREIGN KEY ("comp_id") REFERENCES "public"."matchplay_comps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchplay_entries" ADD CONSTRAINT "matchplay_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchplay_matches" ADD CONSTRAINT "matchplay_matches_comp_id_matchplay_comps_id_fk" FOREIGN KEY ("comp_id") REFERENCES "public"."matchplay_comps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchplay_matches" ADD CONSTRAINT "matchplay_matches_entry_a_matchplay_entries_id_fk" FOREIGN KEY ("entry_a") REFERENCES "public"."matchplay_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchplay_matches" ADD CONSTRAINT "matchplay_matches_entry_b_matchplay_entries_id_fk" FOREIGN KEY ("entry_b") REFERENCES "public"."matchplay_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchplay_matches" ADD CONSTRAINT "matchplay_matches_winner_entry_id_matchplay_entries_id_fk" FOREIGN KEY ("winner_entry_id") REFERENCES "public"."matchplay_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchplay_matches" ADD CONSTRAINT "matchplay_matches_reported_by_matchplay_entries_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."matchplay_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matchplay_comps_club_idx" ON "matchplay_comps" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "matchplay_entries_comp_idx" ON "matchplay_entries" USING btree ("comp_id");--> statement-breakpoint
CREATE UNIQUE INDEX "matchplay_matches_slot_idx" ON "matchplay_matches" USING btree ("comp_id","round","slot");