CREATE TABLE "chat_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chat_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"role" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"image_data" text,
	"image_type" varchar(100),
	"model" varchar(100),
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "components" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "components_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"system_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"component_type" varchar(100),
	"material" varchar(100),
	"install_year" integer,
	"condition" varchar(50) DEFAULT 'Unknown',
	"notes" text,
	"photos" text,
	"provenance_source" varchar(50) DEFAULT 'manual',
	"provenance_confidence" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
	"purpose" text,
	"name" varchar(100) NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"monthly_contribution" integer DEFAULT 0,
	"fund_type" varchar(50) DEFAULT 'general',
	"label" text,
	"color" varchar(20) DEFAULT '#f97316',
	"scoped_system_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "home_documents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "home_documents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"file_type" varchar(100),
	"file_size" integer,
	"object_path" text NOT NULL,
	"category" varchar(100) DEFAULT 'general',
	"notes" text,
	"extracted_data" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "homes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "homes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"address" text,
	"address_line_1" varchar(255),
	"address_line_2" varchar(255),
	"street_address" varchar(255),
	"city" varchar(100),
	"state" varchar(2),
	"zip_code" varchar(10),
	"zip_plus_4" varchar(4),
	"address_verified" boolean DEFAULT false,
	"address_needs_review" boolean DEFAULT false,
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
	"water_shutoff_location" text,
	"gas_shutoff_location" text,
	"electrical_panel_location" text,
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
CREATE TABLE "insurance_policies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "insurance_policies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"policy_type" varchar(50) NOT NULL,
	"carrier" varchar(255),
	"policy_number" varchar(100),
	"agent_name" varchar(255),
	"agent_phone" varchar(50),
	"agent_email" varchar(255),
	"premium_amount" integer,
	"premium_frequency" varchar(50) DEFAULT 'annual',
	"renewal_date" timestamp,
	"coverage_summary" text,
	"document_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "learning_adjustments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "learning_adjustments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"parameter_key" varchar(100) NOT NULL,
	"parameter_value" text NOT NULL,
	"reason" text,
	"data_points" integer DEFAULT 0,
	"confidence" integer DEFAULT 50,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
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
	"is_recurring" boolean DEFAULT false,
	"recurrence_cadence" varchar(50),
	"parent_task_id" integer,
	"assigned_contractor_id" integer,
	"fund_id" integer,
	"completed_at" timestamp,
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
	"contractor_mode" boolean DEFAULT false,
	"last_digest_sent_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "outcome_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "outcome_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"system_id" integer,
	"related_action_id" integer,
	"outcome_type" varchar(50) NOT NULL,
	"severity" varchar(50) DEFAULT 'low',
	"cost_impact" integer,
	"description" text,
	"occurred_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "permits" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "permits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"system_id" integer,
	"permit_number" varchar(100),
	"permit_type" varchar(100),
	"issued_date" timestamp,
	"status" varchar(50) DEFAULT 'unknown',
	"issuing_authority" varchar(255),
	"description" text,
	"document_id" integer,
	"provenance_source" varchar(50) DEFAULT 'manual',
	"provenance_confidence" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recommendations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"system_id" integer,
	"component_id" integer,
	"finding_id" integer,
	"source" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"urgency" varchar(50) DEFAULT 'later',
	"confidence" integer,
	"rationale" text,
	"estimated_cost" varchar(100),
	"status" varchar(50) DEFAULT 'open',
	"task_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "repairs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "repairs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"system_id" integer,
	"component_id" integer,
	"task_id" integer,
	"contractor_id" integer,
	"title" varchar(255) NOT NULL,
	"description" text,
	"repair_date" timestamp,
	"cost" integer,
	"parts_used" text,
	"outcome" varchar(50) DEFAULT 'resolved',
	"provenance_source" varchar(50) DEFAULT 'manual',
	"provenance_confidence" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "replacements" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "replacements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"system_id" integer,
	"component_id" integer,
	"replaced_system_name" varchar(255),
	"replaced_make" varchar(100),
	"replaced_model" varchar(100),
	"replacement_date" timestamp,
	"cost" integer,
	"contractor_id" integer,
	"reason" text,
	"document_id" integer,
	"provenance_source" varchar(50) DEFAULT 'manual',
	"provenance_confidence" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "systems" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "systems_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"entity_type" varchar(20) DEFAULT 'asset',
	"category" varchar(50) DEFAULT 'Other',
	"name" varchar(100) NOT NULL,
	"make" varchar(100),
	"model" varchar(100),
	"serial_number" varchar(100),
	"purchase_date" timestamp,
	"manual_url" text,
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
	"contract_start_date" timestamp,
	"cadence" varchar(50),
	"contractor_id" integer,
	"related_asset_id" integer,
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
CREATE TABLE "timeline_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "timeline_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"event_date" timestamp NOT NULL,
	"category" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"icon" varchar(50),
	"entity_type" varchar(50),
	"entity_id" integer,
	"cost" integer,
	"provenance_source" varchar(50),
	"metadata" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_actions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_actions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"system_id" integer,
	"related_recommendation_id" integer,
	"related_task_id" integer,
	"action_type" varchar(50) NOT NULL,
	"action_date" timestamp DEFAULT now(),
	"cost_actual" integer,
	"contractor_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "utility_accounts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "utility_accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"utility_type" varchar(50) NOT NULL,
	"provider" varchar(255),
	"account_number" varchar(100),
	"contact_phone" varchar(50),
	"website" varchar(255),
	"auto_pay_enabled" boolean DEFAULT false,
	"billing_day_of_month" integer,
	"average_monthly_bill" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "warranties" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "warranties_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"home_id" integer NOT NULL,
	"system_id" integer,
	"component_id" integer,
	"warranty_provider" varchar(255),
	"warranty_type" varchar(100),
	"coverage_summary" text,
	"start_date" timestamp,
	"expiry_date" timestamp,
	"is_transferable" boolean DEFAULT false,
	"document_id" integer,
	"notes" text,
	"provenance_source" varchar(50) DEFAULT 'manual',
	"provenance_confidence" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "disclaimer_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"disclaimer_version" varchar NOT NULL,
	"action" varchar NOT NULL,
	"ip_address" varchar,
	"accepted_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "object_acl" (
	"object_key" varchar PRIMARY KEY NOT NULL,
	"owner_id" varchar,
	"visibility" varchar(10) DEFAULT 'private' NOT NULL,
	"rules" jsonb,
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
	"uuid" varchar DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"provider" varchar,
	"provider_id" varchar,
	"password_hash" varchar,
	"email_verified" boolean DEFAULT false,
	"data_storage_opt_out" boolean DEFAULT false,
	"disclaimer_accepted" boolean DEFAULT false,
	"disclaimer_accepted_at" timestamp,
	"disclaimer_version" varchar,
	"login_count" integer DEFAULT 0,
	"has_donated" boolean DEFAULT false,
	"donation_prompt_snooze_until_login_count" integer,
	"password_reset_token" varchar,
	"password_reset_token_expires_at" timestamp,
	"stripe_customer_id" varchar,
	"stripe_subscription_id" varchar,
	"plan" varchar(20) DEFAULT 'free' NOT NULL,
	"plan_status" varchar(30) DEFAULT 'active' NOT NULL,
	"plan_renews_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
CREATE TABLE "event_log" (
	"event_seq" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "event_log_event_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"event_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"aggregate_version" integer NOT NULL,
	"event_type" text NOT NULL,
	"event_schema_version" integer DEFAULT 1 NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"idempotency_key" text,
	"correlation_id" uuid,
	"causation_id" uuid,
	"session_id" uuid,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_queue" (
	"job_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"locked_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "projection_assistant_action" (
	"assistant_action_id" text PRIMARY KEY NOT NULL,
	"home_id" text NOT NULL,
	"state" text DEFAULT 'proposed' NOT NULL,
	"proposed_commands" jsonb,
	"provenance" jsonb,
	"last_event_seq" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projection_chat_message" (
	"message_id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"seq" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projection_chat_session" (
	"session_id" text PRIMARY KEY NOT NULL,
	"home_id" text NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_event_seq" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projection_checkpoint" (
	"projector_name" text PRIMARY KEY NOT NULL,
	"last_event_seq" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projection_circuit_map" (
	"map_id" text PRIMARY KEY NOT NULL,
	"home_id" text NOT NULL,
	"system_id" text,
	"image_url" text,
	"store_image" integer DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'idle' NOT NULL,
	"breakers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_event_seq" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projection_finding" (
	"finding_id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"home_id" text NOT NULL,
	"system_id" text,
	"state" text DEFAULT 'draft' NOT NULL,
	"card" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_event_seq" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projection_home" (
	"home_id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"legacy_id" integer,
	"attrs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_event_seq" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projection_notification_pref" (
	"home_id" text PRIMARY KEY NOT NULL,
	"prefs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_event_seq" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projection_report" (
	"report_id" text PRIMARY KEY NOT NULL,
	"home_id" text NOT NULL,
	"state" text DEFAULT 'created' NOT NULL,
	"file_hash" text,
	"storage_ref" text,
	"draft" jsonb,
	"published" jsonb,
	"error" jsonb,
	"last_event_seq" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projection_system" (
	"system_id" text PRIMARY KEY NOT NULL,
	"home_id" text NOT NULL,
	"system_type" text,
	"attrs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"health_state" text,
	"risk_score" integer,
	"override" jsonb,
	"last_event_seq" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projection_task" (
	"task_id" text PRIMARY KEY NOT NULL,
	"home_id" text NOT NULL,
	"system_id" text,
	"state" text DEFAULT 'proposed' NOT NULL,
	"title" text,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"estimates" jsonb,
	"last_event_seq" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_outputs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "agent_outputs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"agent_run_id" integer NOT NULL,
	"agent_id" integer NOT NULL,
	"output_type" varchar(100) NOT NULL,
	"title" varchar(500),
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"is_approved" boolean DEFAULT false,
	"is_published" boolean DEFAULT false,
	"reviewed_at" timestamp,
	"reviewed_by" varchar(255),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "agent_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"agent_id" integer NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"triggered_by" varchar(100) DEFAULT 'system',
	"input" jsonb DEFAULT '{}'::jsonb,
	"output" jsonb DEFAULT '{}'::jsonb,
	"error" text,
	"tokens_used" integer,
	"cost_cents" integer,
	"duration_ms" integer,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "agents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(50) DEFAULT 'system' NOT NULL,
	"description" text,
	"purpose" text,
	"trigger" varchar(50) DEFAULT 'manual',
	"schedule" varchar(100),
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"model_id" varchar(100) DEFAULT 'gpt-4o',
	"system_prompt" text,
	"max_tokens" integer DEFAULT 2000,
	"temperature" integer DEFAULT 70,
	"last_run_at" timestamp,
	"last_run_status" varchar(50),
	"next_run_at" timestamp,
	"run_count" integer DEFAULT 0,
	"success_count" integer DEFAULT 0,
	"failure_count" integer DEFAULT 0,
	"is_built_in" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "agents_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_appointments" ADD CONSTRAINT "contractor_appointments_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_appointments" ADD CONSTRAINT "contractor_appointments_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_appointments" ADD CONSTRAINT "contractor_appointments_task_id_maintenance_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."maintenance_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractors" ADD CONSTRAINT "contractors_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_task_id_maintenance_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."maintenance_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_allocations" ADD CONSTRAINT "fund_allocations_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_allocations" ADD CONSTRAINT "fund_allocations_task_id_maintenance_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."maintenance_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funds" ADD CONSTRAINT "funds_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_documents" ADD CONSTRAINT "home_documents_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homes" ADD CONSTRAINT "homes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_findings" ADD CONSTRAINT "inspection_findings_report_id_inspection_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."inspection_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_reports" ADD CONSTRAINT "inspection_reports_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_document_id_home_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."home_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_adjustments" ADD CONSTRAINT "learning_adjustments_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_log_entries" ADD CONSTRAINT "maintenance_log_entries_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_log_entries" ADD CONSTRAINT "maintenance_log_entries_task_id_maintenance_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."maintenance_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_log_entries" ADD CONSTRAINT "maintenance_log_entries_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_related_system_id_systems_id_fk" FOREIGN KEY ("related_system_id") REFERENCES "public"."systems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_events" ADD CONSTRAINT "outcome_events_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_events" ADD CONSTRAINT "outcome_events_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_events" ADD CONSTRAINT "outcome_events_related_action_id_user_actions_id_fk" FOREIGN KEY ("related_action_id") REFERENCES "public"."user_actions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permits" ADD CONSTRAINT "permits_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permits" ADD CONSTRAINT "permits_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permits" ADD CONSTRAINT "permits_document_id_home_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."home_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_finding_id_inspection_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."inspection_findings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_task_id_maintenance_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."maintenance_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_task_id_maintenance_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."maintenance_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replacements" ADD CONSTRAINT "replacements_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replacements" ADD CONSTRAINT "replacements_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replacements" ADD CONSTRAINT "replacements_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replacements" ADD CONSTRAINT "replacements_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replacements" ADD CONSTRAINT "replacements_document_id_home_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."home_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "systems" ADD CONSTRAINT "systems_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_actions" ADD CONSTRAINT "user_actions_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_actions" ADD CONSTRAINT "user_actions_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_actions" ADD CONSTRAINT "user_actions_related_recommendation_id_recommendations_id_fk" FOREIGN KEY ("related_recommendation_id") REFERENCES "public"."recommendations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_actions" ADD CONSTRAINT "user_actions_related_task_id_maintenance_tasks_id_fk" FOREIGN KEY ("related_task_id") REFERENCES "public"."maintenance_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_actions" ADD CONSTRAINT "user_actions_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utility_accounts" ADD CONSTRAINT "utility_accounts_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_document_id_home_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."home_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disclaimer_audit_log" ADD CONSTRAINT "disclaimer_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_outputs" ADD CONSTRAINT "agent_outputs_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_outputs" ADD CONSTRAINT "agent_outputs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_home_id_idx" ON "chat_messages" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "components_home_id_idx" ON "components" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "components_system_id_idx" ON "components" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "contractor_appointments_home_id_idx" ON "contractor_appointments" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "contractor_appointments_status_idx" ON "contractor_appointments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contractors_home_id_idx" ON "contractors" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "contractors_service_type_idx" ON "contractors" USING btree ("service_type");--> statement-breakpoint
CREATE INDEX "expenses_fund_id_idx" ON "expenses" USING btree ("fund_id");--> statement-breakpoint
CREATE INDEX "expenses_task_id_idx" ON "expenses" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "fund_allocations_fund_id_idx" ON "fund_allocations" USING btree ("fund_id");--> statement-breakpoint
CREATE INDEX "fund_allocations_task_id_idx" ON "fund_allocations" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "funds_home_id_idx" ON "funds" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "funds_scoped_system_idx" ON "funds" USING btree ("scoped_system_id");--> statement-breakpoint
CREATE INDEX "home_documents_home_id_idx" ON "home_documents" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "homes_user_id_idx" ON "homes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "inspection_findings_report_id_idx" ON "inspection_findings" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "inspection_reports_home_id_idx" ON "inspection_reports" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "insurance_policies_home_id_idx" ON "insurance_policies" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "insurance_policies_renewal_idx" ON "insurance_policies" USING btree ("renewal_date");--> statement-breakpoint
CREATE INDEX "learning_adjustments_home_id_idx" ON "learning_adjustments" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "learning_adjustments_key_idx" ON "learning_adjustments" USING btree ("parameter_key");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_adjustments_home_param_unique" ON "learning_adjustments" USING btree ("home_id","parameter_key");--> statement-breakpoint
CREATE INDEX "maintenance_log_home_id_idx" ON "maintenance_log_entries" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "maintenance_log_task_id_idx" ON "maintenance_log_entries" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "maintenance_log_date_idx" ON "maintenance_log_entries" USING btree ("date");--> statement-breakpoint
CREATE INDEX "maintenance_tasks_home_id_idx" ON "maintenance_tasks" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "maintenance_tasks_urgency_idx" ON "maintenance_tasks" USING btree ("urgency");--> statement-breakpoint
CREATE INDEX "maintenance_tasks_system_id_idx" ON "maintenance_tasks" USING btree ("related_system_id");--> statement-breakpoint
CREATE INDEX "maintenance_tasks_contractor_idx" ON "maintenance_tasks" USING btree ("assigned_contractor_id");--> statement-breakpoint
CREATE INDEX "outcome_events_home_id_idx" ON "outcome_events" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "outcome_events_system_id_idx" ON "outcome_events" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "outcome_events_date_idx" ON "outcome_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "permits_home_id_idx" ON "permits" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "recommendations_home_id_idx" ON "recommendations" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "recommendations_status_idx" ON "recommendations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "repairs_home_id_idx" ON "repairs" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "repairs_system_id_idx" ON "repairs" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "repairs_date_idx" ON "repairs" USING btree ("repair_date");--> statement-breakpoint
CREATE INDEX "replacements_home_id_idx" ON "replacements" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "replacements_date_idx" ON "replacements" USING btree ("replacement_date");--> statement-breakpoint
CREATE INDEX "systems_home_id_idx" ON "systems" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "systems_category_idx" ON "systems" USING btree ("category");--> statement-breakpoint
CREATE INDEX "systems_entity_type_idx" ON "systems" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "timeline_events_home_id_idx" ON "timeline_events" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "timeline_events_date_idx" ON "timeline_events" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "timeline_events_category_idx" ON "timeline_events" USING btree ("category");--> statement-breakpoint
CREATE INDEX "user_actions_home_id_idx" ON "user_actions" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "user_actions_system_id_idx" ON "user_actions" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "user_actions_date_idx" ON "user_actions" USING btree ("action_date");--> statement-breakpoint
CREATE INDEX "utility_accounts_home_id_idx" ON "utility_accounts" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "warranties_home_id_idx" ON "warranties" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "warranties_system_id_idx" ON "warranties" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "warranties_expiry_idx" ON "warranties" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE UNIQUE INDEX "users_uuid_idx" ON "users" USING btree ("uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "event_log_aggregate_version_uq" ON "event_log" USING btree ("aggregate_type","aggregate_id","aggregate_version");--> statement-breakpoint
CREATE UNIQUE INDEX "event_log_idempotency_uq" ON "event_log" USING btree ("actor_id","idempotency_key") WHERE idempotency_key IS NOT NULL;--> statement-breakpoint
CREATE INDEX "event_log_aggregate_stream_idx" ON "event_log" USING btree ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE INDEX "event_log_seq_idx" ON "event_log" USING btree ("event_seq");--> statement-breakpoint
CREATE INDEX "job_queue_status_run_after_idx" ON "job_queue" USING btree ("status","run_after");--> statement-breakpoint
CREATE INDEX "job_queue_type_idx" ON "job_queue" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "projection_chat_message_session_idx" ON "projection_chat_message" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "agent_outputs_agent_id_idx" ON "agent_outputs" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_outputs_run_id_idx" ON "agent_outputs" USING btree ("agent_run_id");--> statement-breakpoint
CREATE INDEX "agent_outputs_type_idx" ON "agent_outputs" USING btree ("output_type");--> statement-breakpoint
CREATE INDEX "agent_runs_agent_id_idx" ON "agent_runs" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_runs_status_idx" ON "agent_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_runs_started_at_idx" ON "agent_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "agents_type_idx" ON "agents" USING btree ("type");--> statement-breakpoint
CREATE INDEX "agents_status_idx" ON "agents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agents_slug_idx" ON "agents" USING btree ("slug");