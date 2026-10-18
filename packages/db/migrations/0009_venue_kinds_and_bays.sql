CREATE TYPE "public"."venue_kind" AS ENUM('course', 'simulator', 'range');--> statement-breakpoint
-- Rebuilt rather than ADD VALUE, so the next migration can use 'ygb' in the same transaction.
ALTER TYPE "public"."platform" RENAME TO "platform_old";--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('miclub', 'quick18', 'chronogolf', 'manual', 'ygb');--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "platform" TYPE "public"."platform" USING "platform"::text::"public"."platform";--> statement-breakpoint
DROP TYPE "public"."platform_old";--> statement-breakpoint
ALTER TABLE "availability_snapshots" ADD COLUMN "bay" text;--> statement-breakpoint
ALTER TABLE "availability_snapshots" ADD COLUMN "durations" smallint[];--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "kind" "venue_kind" DEFAULT 'course' NOT NULL;