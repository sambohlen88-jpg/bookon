CREATE TABLE "weather_forecasts" (
	"course_id" uuid PRIMARY KEY NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_modified" text,
	"hours" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "area" text;--> statement-breakpoint
ALTER TABLE "weather_forecasts" ADD CONSTRAINT "weather_forecasts_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Starting areas for the seeded courses (SEED_AREAS in src/seed.ts), so no reseed is needed.
UPDATE "courses" SET "area" = 'north' WHERE "area" IS NULL AND "slug" IN ('marangaroo', 'joondalup-resort', 'sun-city', 'hamersley', 'wembley');--> statement-breakpoint
UPDATE "courses" SET "area" = 'west' WHERE "area" IS NULL AND "slug" IN ('lake-claremont', 'point-walter', 'fremantle-public');--> statement-breakpoint
UPDATE "courses" SET "area" = 'east' WHERE "area" IS NULL AND "slug" IN ('maylands', 'hartfield', 'the-springs');--> statement-breakpoint
UPDATE "courses" SET "area" = 'south' WHERE "area" IS NULL AND "slug" IN ('collier-park', 'whaleback', 'kwinana');--> statement-breakpoint
UPDATE "courses" SET "area" = 'rockingham' WHERE "area" IS NULL AND "slug" IN ('rockingham', 'secret-harbour', 'kennedy-bay');--> statement-breakpoint
UPDATE "courses" SET "area" = 'peel' WHERE "area" IS NULL AND "slug" IN ('meadow-springs', 'the-cut', 'pinjarra');--> statement-breakpoint
UPDATE "courses" SET "area" = 'south-west' WHERE "area" IS NULL AND "slug" IN ('bunbury', 'capel', 'busselton', 'dunsborough-lakes', 'margaret-river');--> statement-breakpoint
UPDATE "courses" SET "area" = 'regional' WHERE "area" IS NULL AND "slug" IN ('albany', 'geraldton', 'karratha', 'broome');
