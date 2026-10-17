ALTER TABLE "click_events" DROP CONSTRAINT "click_events_notification_id_notifications_id_fk";
--> statement-breakpoint
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE set null ON UPDATE no action;