-- The owner's simpler areas (19 October 2026): North, East, South, West and Regional WA.
-- Rockingham and Mandurah & Peel join South; South West joins Regional WA.
UPDATE "courses" SET "area" = 'south' WHERE "area" IN ('rockingham', 'peel');--> statement-breakpoint
UPDATE "courses" SET "area" = 'regional' WHERE "area" = 'south-west';--> statement-breakpoint
UPDATE "coaches" SET "profile" = jsonb_set("profile", '{area}', to_jsonb(CASE WHEN "profile"->>'area' = 'south-west' THEN 'regional' ELSE 'south' END)) WHERE "profile"->>'area' IN ('rockingham', 'peel', 'south-west');--> statement-breakpoint
UPDATE "coaches" SET "draft" = jsonb_set("draft", '{area}', to_jsonb(CASE WHEN "draft"->>'area' = 'south-west' THEN 'regional' ELSE 'south' END)) WHERE "draft"->>'area' IN ('rockingham', 'peel', 'south-west');
