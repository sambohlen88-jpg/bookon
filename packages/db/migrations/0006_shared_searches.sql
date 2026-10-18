ALTER TYPE "public"."click_source" ADD VALUE 'share';--> statement-breakpoint
CREATE TABLE "shared_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"anonymous_session_id" text,
	"query" text NOT NULL,
	"params" jsonb NOT NULL,
	"courses" jsonb NOT NULL,
	"total_tee_times" integer NOT NULL,
	CONSTRAINT "shared_searches_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE INDEX "shared_searches_expires_idx" ON "shared_searches" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "shared_searches_session_idx" ON "shared_searches" USING btree ("anonymous_session_id","created_at");