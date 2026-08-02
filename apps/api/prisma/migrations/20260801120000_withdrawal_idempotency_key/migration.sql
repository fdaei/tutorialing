-- Nullable so rows created before this column keep validating; Postgres treats
-- each NULL as distinct under a unique index, so they do not collide.
ALTER TABLE "WithdrawalRequest" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "WithdrawalRequest_idempotencyKey_key" ON "WithdrawalRequest"("idempotencyKey");
