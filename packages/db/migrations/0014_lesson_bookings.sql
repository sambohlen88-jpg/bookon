CREATE TYPE "public"."lesson_status" AS ENUM('checkout', 'requested', 'confirmed', 'declined', 'lapsed', 'cancelled', 'abandoned');--> statement-breakpoint
CREATE TABLE "lesson_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"status" "lesson_status" DEFAULT 'checkout' NOT NULL,
	"rate" jsonb NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"place" text NOT NULL,
	"golfer_name" text NOT NULL,
	"golfer_email" text NOT NULL,
	"golfer_phone" text NOT NULL,
	"note" text,
	"user_id" uuid,
	"lesson_cents" integer NOT NULL,
	"fee_cents" integer NOT NULL,
	"manage_token" text NOT NULL,
	"provider" text NOT NULL,
	"checkout_id" text,
	"checkout_expires_at" timestamp with time zone NOT NULL,
	"payment_id" text,
	"requested_at" timestamp with time zone,
	"respond_by" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" text,
	"refund_cents" integer DEFAULT 0 NOT NULL,
	"coach_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_bookings_manage_token_unique" UNIQUE("manage_token")
);
--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "payment_account_id" text;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "payments_ready" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "takes_bookings" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_bookings" ADD CONSTRAINT "lesson_bookings_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_bookings" ADD CONSTRAINT "lesson_bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_bookings_coach_time_idx" ON "lesson_bookings" USING btree ("coach_id","start_time");--> statement-breakpoint
CREATE INDEX "lesson_bookings_email_idx" ON "lesson_bookings" USING btree ("golfer_email");--> statement-breakpoint
CREATE INDEX "lesson_bookings_status_idx" ON "lesson_bookings" USING btree ("status");