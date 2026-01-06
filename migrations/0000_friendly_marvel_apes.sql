CREATE TABLE "chat_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chat_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"role" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contact_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"subject" varchar(255),
	"message" text NOT NULL,
	"status" varchar(50) DEFAULT 'new',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contractor_appointments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contractor_appointments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"contractor_id" integer,
	"task_id" integer,
	"title" varchar(255) NOT NULL,
	"scheduled_date" timestamp,
	"status" varchar(50) DEFAULT 'inquiry',
	"estimated_cost" varchar(100),
	"actual_cost" integer,
	"notes" text,
	"angies_list_inquiry_id" varchar(100),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contractors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contractors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"service_type" varchar(100),
	"phone" varchar(50),
	"email" varchar(255),
	"website" text,
	"angies_list_url" text,
	"notes" text,
	"rating" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expenses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"fund_id" integer NOT NULL,
	"task_id" integer,
	"amount" integer DEFAULT 0 NOT NULL,
	"description" text,
	"payment_status" varchar(50) DEFAULT 'paid',
	"paid_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fund_allocations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fund_allocations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"fund_id" integer NOT NULL,
	"task_id" integer NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"status" varchar(50) DEFAULT 'planned',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "funds" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "funds_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"monthly_contribution" integer DEFAULT 0,
	"fund_type" varchar(50) DEFAULT 'general',
	"label" text,
	"color" varchar(20) DEFAULT '#f97316',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "homes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "homes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"address" text NOT NULL,
	"street_address" varchar(255),
	"city" varchar(100),
	"state" varchar(2),
	"zip_code" varchar(10),
	"zip_plus_4" varchar(4),
	"address_verified" boolean DEFAULT false,
	"built_year" integer,
	"sq_ft" integer,
	"beds" integer,
	"baths" integer,
	"type" varchar(100),
	"lot_size" integer,
	"exterior_type" varchar(100),
	"roof_type" varchar(100),
	"last_sale_year" integer,
	"home_value_estimate" integer,
	"data_source" varchar(50) DEFAULT 'manual',
	"zillow_url" text,
	"health_score" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inspection_findings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inspection_findings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"report_id" integer NOT NULL,
	"category" varchar(100),
	"title" varchar(255) NOT NULL,
	"description" text,
	"severity" varchar(50) DEFAULT 'minor',
	"location" varchar(255),
	"estimated_cost" varchar(100),
	"urgency" varchar(50) DEFAULT 'later',
	"diy_level" varchar(50) DEFAULT 'Pro-Only',
	"task_created" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inspection_reports" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inspection_reports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_type" varchar(100),
	"object_path" text NOT NULL,
	"report_type" varchar(100) DEFAULT 'general',
	"inspection_date" timestamp,
	"status" varchar(50) DEFAULT 'pending',
	"summary" text,
	"issues_found" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"analyzed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "maintenance_log_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "maintenance_log_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"task_id" integer,
	"system_id" integer,
	"date" timestamp DEFAULT now() NOT NULL,
	"title" varchar(255) NOT NULL,
	"notes" text,
	"photos" text,
	"cost" integer,
	"provider" varchar(255),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "maintenance_tasks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "maintenance_tasks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"related_system_id" integer,
	"title" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"due_date" timestamp,
	"urgency" varchar(50) DEFAULT 'later',
	"diy_level" varchar(50) DEFAULT 'DIY-Safe',
	"status" varchar(50) DEFAULT 'pending',
	"estimated_cost" varchar(100),
	"actual_cost" integer,
	"difficulty" varchar(50),
	"safety_warning" text,
	"created_from" varchar(50) DEFAULT 'manual',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notification_preferences_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"maintenance_reminders" boolean DEFAULT true,
	"contractor_followups" boolean DEFAULT true,
	"system_alerts" boolean DEFAULT true,
	"weekly_digest" boolean DEFAULT false,
	"push_enabled" boolean DEFAULT false,
	"email_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "systems" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "systems_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"category" varchar(50) DEFAULT 'Other',
	"name" varchar(100) NOT NULL,
	"make" varchar(100),
	"model" varchar(100),
	"install_year" integer,
	"last_service_date" timestamp,
	"next_service_date" timestamp,
	"condition" varchar(50) DEFAULT 'Unknown',
	"warranty_expiry" timestamp,
	"material" varchar(100),
	"energy_rating" varchar(50),
	"provider" varchar(255),
	"treatment_type" varchar(100),
	"recurrence_interval" varchar(50),
	"status_reason" text,
	"metadata" text,
	"notes" text,
	"photos" text,
	"documents" text,
	"source" varchar(50) DEFAULT 'manual',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_appointments" ADD CONSTRAINT "contractor_appointments_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_appointments" ADD CONSTRAINT "contractor_appointments_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_appointments" ADD CONSTRAINT "contractor_appointments_task_id_maintenance_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."maintenance_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractors" ADD CONSTRAINT "contractors_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_task_id_maintenance_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."maintenance_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_allocations" ADD CONSTRAINT "fund_allocations_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_allocations" ADD CONSTRAINT "fund_allocations_task_id_maintenance_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."maintenance_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funds" ADD CONSTRAINT "funds_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homes" ADD CONSTRAINT "homes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_findings" ADD CONSTRAINT "inspection_findings_report_id_inspection_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."inspection_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_reports" ADD CONSTRAINT "inspection_reports_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_log_entries" ADD CONSTRAINT "maintenance_log_entries_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_log_entries" ADD CONSTRAINT "maintenance_log_entries_task_id_maintenance_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."maintenance_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_log_entries" ADD CONSTRAINT "maintenance_log_entries_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_related_system_id_systems_id_fk" FOREIGN KEY ("related_system_id") REFERENCES "public"."systems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "systems" ADD CONSTRAINT "systems_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_home_id_idx" ON "chat_messages" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "contractor_appointments_home_id_idx" ON "contractor_appointments" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "contractor_appointments_status_idx" ON "contractor_appointments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contractors_home_id_idx" ON "contractors" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "contractors_service_type_idx" ON "contractors" USING btree ("service_type");--> statement-breakpoint
CREATE INDEX "expenses_fund_id_idx" ON "expenses" USING btree ("fund_id");--> statement-breakpoint
CREATE INDEX "expenses_task_id_idx" ON "expenses" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "fund_allocations_fund_id_idx" ON "fund_allocations" USING btree ("fund_id");--> statement-breakpoint
CREATE INDEX "fund_allocations_task_id_idx" ON "fund_allocations" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "funds_home_id_idx" ON "funds" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "homes_user_id_idx" ON "homes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "inspection_findings_report_id_idx" ON "inspection_findings" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "inspection_reports_home_id_idx" ON "inspection_reports" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "maintenance_log_home_id_idx" ON "maintenance_log_entries" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "maintenance_log_task_id_idx" ON "maintenance_log_entries" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "maintenance_log_date_idx" ON "maintenance_log_entries" USING btree ("date");--> statement-breakpoint
CREATE INDEX "maintenance_tasks_home_id_idx" ON "maintenance_tasks" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "maintenance_tasks_urgency_idx" ON "maintenance_tasks" USING btree ("urgency");--> statement-breakpoint
CREATE INDEX "maintenance_tasks_system_id_idx" ON "maintenance_tasks" USING btree ("related_system_id");--> statement-breakpoint
CREATE INDEX "systems_home_id_idx" ON "systems" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "systems_category_idx" ON "systems" USING btree ("category");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");