CREATE TABLE "unbooked_slots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"course_id" uuid NOT NULL,
	"play_date" date NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"holes" smallint NOT NULL,
	"layout" text,
	"spots_left" smallint NOT NULL,
	"price_cents" integer,
	"last_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "unbooked_slots" ADD CONSTRAINT "unbooked_slots_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unbooked_slots_once" ON "unbooked_slots" USING btree ("course_id","start_time","holes",coalesce("layout", ''));--> statement-breakpoint
CREATE INDEX "unbooked_slots_date_idx" ON "unbooked_slots" USING btree ("play_date");--> statement-breakpoint
-- When recording began, so Reports only counts checks from then on.
INSERT INTO "app_settings" ("key", "value") VALUES ('unbooked_since', to_jsonb(now())) ON CONFLICT ("key") DO NOTHING;
