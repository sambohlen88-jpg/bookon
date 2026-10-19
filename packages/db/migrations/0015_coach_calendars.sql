CREATE TABLE "coach_busy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"source" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "calendar_token" text;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "busy_calendar_url" text;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "busy_calendar_read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "busy_calendar_error" text;--> statement-breakpoint
ALTER TABLE "coach_busy" ADD CONSTRAINT "coach_busy_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_busy_coach_time_idx" ON "coach_busy" USING btree ("coach_id","start_time");--> statement-breakpoint
ALTER TABLE "coaches" ADD CONSTRAINT "coaches_calendar_token_unique" UNIQUE("calendar_token");