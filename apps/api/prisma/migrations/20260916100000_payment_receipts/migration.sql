ALTER TABLE "Payment"
  ADD COLUMN "receiptFileId" TEXT,
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewNote" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_receiptFileId_fkey"
  FOREIGN KEY ("receiptFileId") REFERENCES "StoredFile"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "Payment_receiptFileId_idx" ON "Payment"("receiptFileId");
