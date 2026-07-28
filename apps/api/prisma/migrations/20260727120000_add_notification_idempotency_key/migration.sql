-- Add an idempotency key so retried BullMQ jobs (e.g. booking-reminder) do not
-- create duplicate notifications/deliveries for the same recipient.
ALTER TABLE "Notification" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Notification_idempotencyKey_key" ON "Notification"("idempotencyKey");
