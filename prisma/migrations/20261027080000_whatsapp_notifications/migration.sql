-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'REMINDER_24H';
ALTER TYPE "NotificationKind" ADD VALUE 'REMINDER_3H';

-- CreateIndex
CREATE UNIQUE INDEX "notifications_appointment_id_kind_key" ON "notifications"("appointment_id", "kind");