-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "whatsapp_opt_in" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "last_error" TEXT;
