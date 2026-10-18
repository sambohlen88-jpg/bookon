CREATE TYPE "public"."coach_status" AS ENUM('new', 'live', 'declined', 'hidden');--> statement-breakpoint
CREATE TABLE "coach_contacts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"coach_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"method" text NOT NULL,
	"anonymous_session_id" text
);
--> statement-breakpoint
CREATE TABLE "coach_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "photo_status" DEFAULT 'pending' NOT NULL,
	"content_type" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"rights_confirmed_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coaches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"email" text NOT NULL,
	"status" "coach_status" DEFAULT 'new' NOT NULL,
	"profile" jsonb,
	"draft" jsonb,
	"submitted_at" timestamp with time zone,
	"pga_verified" boolean DEFAULT false NOT NULL,
	"sample" boolean DEFAULT false NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"consents" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"review_note" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coaches_slug_unique" UNIQUE("slug"),
	CONSTRAINT "coaches_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "coach_contacts" ADD CONSTRAINT "coach_contacts_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_photos" ADD CONSTRAINT "coach_photos_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_contacts_coach_idx" ON "coach_contacts" USING btree ("coach_id","at");--> statement-breakpoint
CREATE INDEX "coach_photos_coach_idx" ON "coach_photos" USING btree ("coach_id","status");--> statement-breakpoint
CREATE INDEX "coaches_status_idx" ON "coaches" USING btree ("status");