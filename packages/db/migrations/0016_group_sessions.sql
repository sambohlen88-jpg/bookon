CREATE TYPE "public"."group_booking_status" AS ENUM('checkout', 'paid', 'cancelled', 'abandoned');--> statement-breakpoint
CREATE TABLE "group_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"status" "group_booking_status" DEFAULT 'checkout' NOT NULL,
	"spots" integer NOT NULL,
	"golfer_name" text NOT NULL,
	"golfer_email" text NOT NULL,
	"golfer_phone" text NOT NULL,
	"note" text,
	"user_id" uuid,
	"spots_cents" integer NOT NULL,
	"fee_cents" integer NOT NULL,
	"manage_token" text NOT NULL,
	"provider" text NOT NULL,
	"checkout_id" text,
	"checkout_expires_at" timestamp with time zone NOT NULL,
	"payment_id" text,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" text,
	"refund_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_bookings_manage_token_unique" UNIQUE("manage_token")
);
--> statement-breakpoint
CREATE TABLE "group_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"series_id" uuid,
	"title" text NOT NULL,
	"details" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"place" text NOT NULL,
	"price_cents" integer NOT NULL,
	"spots" integer NOT NULL,
	"min_spots" integer,
	"status" text DEFAULT 'open' NOT NULL,
	"going_ahead_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" text,
	"coach_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "group_bookings" ADD CONSTRAINT "group_bookings_session_id_group_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."group_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_bookings" ADD CONSTRAINT "group_bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_sessions" ADD CONSTRAINT "group_sessions_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_bookings_session_idx" ON "group_bookings" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "group_bookings_email_idx" ON "group_bookings" USING btree ("golfer_email");--> statement-breakpoint
CREATE INDEX "group_bookings_status_idx" ON "group_bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "group_sessions_coach_time_idx" ON "group_sessions" USING btree ("coach_id","start_time");--> statement-breakpoint
CREATE INDEX "group_sessions_status_time_idx" ON "group_sessions" USING btree ("status","start_time");