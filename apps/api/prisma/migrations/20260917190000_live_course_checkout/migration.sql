-- Link the class times selected during a live-course purchase to its receipt.
-- The pending bookings hold those slots until an admin approves or rejects it.
ALTER TABLE "Booking" ADD COLUMN "courseSessionPaymentId" TEXT;

CREATE INDEX "Booking_courseSessionPaymentId_idx" ON "Booking"("courseSessionPaymentId");

ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_courseSessionPaymentId_fkey"
FOREIGN KEY ("courseSessionPaymentId") REFERENCES "Payment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
