CREATE TABLE "newsletter_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"status" text NOT NULL,
	"source" text NOT NULL,
	"consent_text" text NOT NULL,
	"consented_at" timestamp with time zone NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"unsubscribed_via" text,
	"updated_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone,
	"sync_error" text,
	CONSTRAINT "newsletter_subscribers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "sign_in_tokens" ADD COLUMN "newsletter" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "newsletter_subscribers_status_idx" ON "newsletter_subscribers" USING btree ("status");