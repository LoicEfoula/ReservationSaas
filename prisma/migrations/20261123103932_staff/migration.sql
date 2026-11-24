-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "staff_id" UUID;

-- AlterTable
ALTER TABLE "closures" ADD COLUMN     "staff_id" UUID;

-- AlterTable
ALTER TABLE "opening_hours" ADD COLUMN     "staff_id" UUID;

-- CreateTable
CREATE TABLE "staff" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_services" (
    "staff_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,

    CONSTRAINT "staff_services_pkey" PRIMARY KEY ("staff_id","service_id")
);

-- CreateIndex
CREATE INDEX "staff_provider_id_idx" ON "staff"("provider_id");

-- CreateIndex
CREATE INDEX "appointments_staff_id_starts_at_idx" ON "appointments"("staff_id", "starts_at");

-- CreateIndex
CREATE INDEX "closures_staff_id_starts_at_idx" ON "closures"("staff_id", "starts_at");

-- CreateIndex
CREATE INDEX "opening_hours_staff_id_weekday_idx" ON "opening_hours"("staff_id", "weekday");

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closures" ADD CONSTRAINT "closures_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Un coiffeur "principal" par salon existant, qui reprend les données actuelles
INSERT INTO "staff" ("id", "provider_id", "name", "active", "created_at")
SELECT gen_random_uuid(), p."id", p."owner_name", true, now() FROM "providers" p;

UPDATE "opening_hours" o SET "staff_id" = s."id" FROM "staff" s WHERE s."provider_id" = o."provider_id";
UPDATE "closures" c SET "staff_id" = s."id" FROM "staff" s WHERE s."provider_id" = c."provider_id";
UPDATE "appointments" a SET "staff_id" = s."id" FROM "staff" s WHERE s."provider_id" = a."provider_id";

INSERT INTO "staff_services" ("staff_id", "service_id")
SELECT s."id", sv."id" FROM "staff" s JOIN "services" sv ON sv."provider_id" = s."provider_id";
