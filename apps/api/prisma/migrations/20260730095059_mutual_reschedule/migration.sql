-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "rescheduleAskedAt" TIMESTAMP(3),
ADD COLUMN     "rescheduleStartsAt" TIMESTAMP(3),
ADD COLUMN     "rescheduleTimezone" TEXT,
ADD COLUMN     "reschedulerId" TEXT;
