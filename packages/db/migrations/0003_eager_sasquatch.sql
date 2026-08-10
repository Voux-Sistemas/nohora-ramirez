DROP INDEX "auth_otps_phone_idx";--> statement-breakpoint
ALTER TABLE "auth_otps" ADD COLUMN "purpose" text DEFAULT 'login' NOT NULL;--> statement-breakpoint
CREATE INDEX "auth_otps_phone_idx" ON "auth_otps" USING btree ("phone","purpose","expires_at");