CREATE TYPE "public"."commission_status" AS ENUM('pending', 'paid');--> statement-breakpoint
CREATE TABLE "commission_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_item_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"base_amount" integer NOT NULL,
	"percent_bps" integer NOT NULL,
	"amount" integer NOT NULL,
	"status" "commission_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_entries_appointment_item_id_unique" UNIQUE("appointment_item_id")
);
--> statement-breakpoint
CREATE TABLE "commission_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"staff_id" uuid,
	"service_id" uuid,
	"percent_bps" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_appointment_item_id_appointment_items_id_fk" FOREIGN KEY ("appointment_item_id") REFERENCES "public"."appointment_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_staff_id_staff_profiles_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_staff_id_staff_profiles_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commission_entries_staff_status_idx" ON "commission_entries" USING btree ("staff_id","status");--> statement-breakpoint
CREATE INDEX "commission_entries_staff_created_idx" ON "commission_entries" USING btree ("staff_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_rules_scope_uq" ON "commission_rules" USING btree ("organization_id","staff_id","service_id");--> statement-breakpoint
CREATE INDEX "commission_rules_org_idx" ON "commission_rules" USING btree ("organization_id");
--> statement-breakpoint
-- O site entra como `app_web`, que só faz DML (ADR-009). O `sql/03_app_web_role.sql`
-- já deixou ALTER DEFAULT PRIVILEGES a cobrir as tabelas que nascem depois dele,
-- portanto isto é cinto por cima de suspensórios: se a migração alguma vez correr
-- por outro dono, as duas tabelas nascem sem GRANT e o site responde 500 ao
-- primeiro SELECT — falha que só aparece em produção, e tarde.
DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_web') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "commission_rules", "commission_entries" TO app_web;
  END IF;
END
$mig$;
