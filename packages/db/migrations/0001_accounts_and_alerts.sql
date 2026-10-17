ALTER TYPE "public"."alert_status" ADD VALUE 'ended';--> statement-breakpoint
CREATE TABLE "favourites" (
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favourites_user_id_course_id_pk" PRIMARY KEY("user_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "outbox_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"text" text NOT NULL,
	"html" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sign_in_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"next" text,
	CONSTRAINT "sign_in_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sign_in_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "click_token" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "click_events" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "baseline" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sign_in_tokens_email_created_idx" ON "sign_in_tokens" USING btree ("email","created_at");--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;