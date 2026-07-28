-- Link a payment to the discount whose use it reserved, so the reservation can
-- be released when the payment fails or expires instead of permanently
-- consuming the code's maxUses budget.
ALTER TABLE "Payment" ADD COLUMN "discountId" TEXT;

CREATE INDEX "Payment_discountId_idx" ON "Payment"("discountId");

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_discountId_fkey"
  FOREIGN KEY ("discountId") REFERENCES "Discount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
