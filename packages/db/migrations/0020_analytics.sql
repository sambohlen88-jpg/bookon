CREATE TABLE "analytics_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"visitor_id" text NOT NULL,
	"name" text NOT NULL,
	"section" text,
	"label" text
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"visitor_id" text NOT NULL,
	"visit_id" uuid NOT NULL,
	"entry" boolean DEFAULT false NOT NULL,
	"path" text NOT NULL,
	"section" text NOT NULL,
	"channel" text,
	"source" text,
	"referrer_host" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"device" text NOT NULL,
	"browser" text NOT NULL,
	"os" text NOT NULL,
	"app" boolean DEFAULT false NOT NULL,
	"signed_in" boolean DEFAULT false NOT NULL,
	"country" text,
	"region" text,
	"city" text,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "web_vitals" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"section" text NOT NULL,
	"metric" text NOT NULL,
	"value" double precision NOT NULL,
	"device" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "analytics_events_name_idx" ON "analytics_events" USING btree ("name","at");--> statement-breakpoint
CREATE INDEX "page_views_at_idx" ON "page_views" USING btree ("at");--> statement-breakpoint
CREATE INDEX "page_views_visitor_idx" ON "page_views" USING btree ("visitor_id","at");--> statement-breakpoint
CREATE INDEX "page_views_visit_idx" ON "page_views" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "web_vitals_at_idx" ON "web_vitals" USING btree ("at");