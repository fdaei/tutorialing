-- New teacher bookings are paid entirely from the wallet. Historical payment
-- rows retain gatewayAmount so old gateway bookings remain reportable.
ALTER TYPE "EarningStatus" ADD VALUE IF NOT EXISTS 'REVERSED';

-- One live booking per exact teacher/start instant. Existing overlap checks
-- remain authoritative for variable durations; this closes the common race at
-- the database boundary even if Redis is unavailable.
CREATE UNIQUE INDEX IF NOT EXISTS "Booking_teacherId_startsAt_live_key"
ON "Booking" ("teacherId", "startsAt")
WHERE "status" IN ('PENDING_PAYMENT', 'CONFIRMED');
