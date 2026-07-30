-- CreateEnum
CREATE TYPE "DiscountTrigger" AS ENUM ('BIRTHDAY');

-- AlterTable
ALTER TABLE "Package" ADD COLUMN     "discountPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "listPrice" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "discountRuleId" TEXT;

-- AlterTable
ALTER TABLE "Teacher" ALTER COLUMN "breakMinutes" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "birthDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DiscountRule" (
    "id" TEXT NOT NULL,
    "trigger" "DiscountTrigger" NOT NULL,
    "type" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "maxAmount" INTEGER,
    "windowDays" INTEGER NOT NULL DEFAULT 7,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscountRule_trigger_active_idx" ON "DiscountRule"("trigger", "active");

-- CreateIndex
CREATE INDEX "Payment_discountRuleId_idx" ON "Payment"("discountRuleId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_discountRuleId_fkey" FOREIGN KEY ("discountRuleId") REFERENCES "DiscountRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

