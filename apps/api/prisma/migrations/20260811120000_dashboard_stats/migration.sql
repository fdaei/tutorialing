-- A singleton, transactionally-maintained projection for the admin dashboard.
-- Locks make the initial backfill and trigger installation an atomic cut-over:
-- writers cannot slip between the snapshot and trigger creation.
CREATE TABLE "DashboardStat" (
  "id" TEXT NOT NULL DEFAULT 'platform',
  "activeUsers" BIGINT NOT NULL DEFAULT 0,
  "activeTeachers" BIGINT NOT NULL DEFAULT 0,
  "pendingTeachers" BIGINT NOT NULL DEFAULT 0,
  "testAttempts" BIGINT NOT NULL DEFAULT 0,
  "pendingReviews" BIGINT NOT NULL DEFAULT 0,
  "bookings" BIGINT NOT NULL DEFAULT 0,
  "payments" BIGINT NOT NULL DEFAULT 0,
  "payouts" BIGINT NOT NULL DEFAULT 0,
  "openTickets" BIGINT NOT NULL DEFAULT 0,
  "revenue" BIGINT NOT NULL DEFAULT 0,
  "walletCredits" BIGINT NOT NULL DEFAULT 0,
  "walletDebits" BIGINT NOT NULL DEFAULT 0,
  "reconciledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DashboardStat_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DashboardStat_singleton" CHECK ("id" = 'platform'),
  CONSTRAINT "DashboardStat_nonnegative" CHECK (
    "activeUsers" >= 0 AND "activeTeachers" >= 0 AND "pendingTeachers" >= 0 AND
    "testAttempts" >= 0 AND "pendingReviews" >= 0 AND "bookings" >= 0 AND
    "payments" >= 0 AND "payouts" >= 0 AND "openTickets" >= 0 AND
    "revenue" >= 0 AND "walletCredits" >= 0 AND "walletDebits" >= 0
  )
);

LOCK TABLE "User", "Teacher", "TestAttempt", "Booking", "Payment", "PayoutBatch", "Ticket", "WalletEntry" IN SHARE ROW EXCLUSIVE MODE;

INSERT INTO "DashboardStat" (
  "id", "activeUsers", "activeTeachers", "pendingTeachers", "testAttempts",
  "pendingReviews", "bookings", "payments", "payouts", "openTickets",
  "revenue", "walletCredits", "walletDebits", "reconciledAt", "updatedAt"
)
SELECT
  'platform',
  (SELECT COUNT(*) FROM "User" WHERE "status" = 'ACTIVE'),
  (SELECT COUNT(*) FROM "Teacher" WHERE "status" = 'APPROVED'),
  (SELECT COUNT(*) FROM "Teacher" WHERE "status" IN ('SUBMITTED','DOCUMENT_REVIEW','INTERVIEW','DEMO_REVIEW')),
  (SELECT COUNT(*) FROM "TestAttempt"),
  (SELECT COUNT(*) FROM "TestAttempt" WHERE "status" = 'UNDER_REVIEW'),
  (SELECT COUNT(*) FROM "Booking"),
  (SELECT COUNT(*) FROM "Payment"),
  (SELECT COUNT(*) FROM "PayoutBatch"),
  (SELECT COUNT(*) FROM "Ticket" WHERE "status" IN ('OPEN','WAITING_SUPPORT')),
  COALESCE((SELECT SUM("amount") FROM "Payment" WHERE "status" = 'PAID'), 0),
  COALESCE((SELECT SUM("amount") FROM "WalletEntry" WHERE "direction" = 'CREDIT'), 0),
  COALESCE((SELECT SUM("amount") FROM "WalletEntry" WHERE "direction" = 'DEBIT'), 0),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP;

CREATE FUNCTION dashboard_stat_users() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE delta BIGINT := 0;
BEGIN
  IF TG_OP <> 'INSERT' AND OLD."status" = 'ACTIVE' THEN delta := delta - 1; END IF;
  IF TG_OP <> 'DELETE' AND NEW."status" = 'ACTIVE' THEN delta := delta + 1; END IF;
  UPDATE "DashboardStat" SET "activeUsers" = GREATEST(0, "activeUsers" + delta), "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'platform';
  RETURN NULL;
END $$;

CREATE FUNCTION dashboard_stat_teachers() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE approved_delta BIGINT := 0; pending_delta BIGINT := 0;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    IF OLD."status" = 'APPROVED' THEN approved_delta := approved_delta - 1; END IF;
    IF OLD."status" IN ('SUBMITTED','DOCUMENT_REVIEW','INTERVIEW','DEMO_REVIEW') THEN pending_delta := pending_delta - 1; END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    IF NEW."status" = 'APPROVED' THEN approved_delta := approved_delta + 1; END IF;
    IF NEW."status" IN ('SUBMITTED','DOCUMENT_REVIEW','INTERVIEW','DEMO_REVIEW') THEN pending_delta := pending_delta + 1; END IF;
  END IF;
  UPDATE "DashboardStat" SET "activeTeachers" = GREATEST(0, "activeTeachers" + approved_delta), "pendingTeachers" = GREATEST(0, "pendingTeachers" + pending_delta), "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'platform';
  RETURN NULL;
END $$;

CREATE FUNCTION dashboard_stat_attempts() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE total_delta BIGINT := 0; pending_delta BIGINT := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN total_delta := 1; ELSIF TG_OP = 'DELETE' THEN total_delta := -1; END IF;
  IF TG_OP <> 'INSERT' AND OLD."status" = 'UNDER_REVIEW' THEN pending_delta := pending_delta - 1; END IF;
  IF TG_OP <> 'DELETE' AND NEW."status" = 'UNDER_REVIEW' THEN pending_delta := pending_delta + 1; END IF;
  UPDATE "DashboardStat" SET "testAttempts" = GREATEST(0, "testAttempts" + total_delta), "pendingReviews" = GREATEST(0, "pendingReviews" + pending_delta), "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'platform';
  RETURN NULL;
END $$;

CREATE FUNCTION dashboard_stat_bookings() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE delta BIGINT := CASE TG_OP WHEN 'INSERT' THEN 1 WHEN 'DELETE' THEN -1 ELSE 0 END;
BEGIN
  UPDATE "DashboardStat" SET "bookings" = GREATEST(0, "bookings" + delta), "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'platform';
  RETURN NULL;
END $$;

CREATE FUNCTION dashboard_stat_payments() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE total_delta BIGINT := 0; revenue_delta BIGINT := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN total_delta := 1; ELSIF TG_OP = 'DELETE' THEN total_delta := -1; END IF;
  IF TG_OP <> 'INSERT' AND OLD."status" = 'PAID' THEN revenue_delta := revenue_delta - OLD."amount"; END IF;
  IF TG_OP <> 'DELETE' AND NEW."status" = 'PAID' THEN revenue_delta := revenue_delta + NEW."amount"; END IF;
  UPDATE "DashboardStat" SET "payments" = GREATEST(0, "payments" + total_delta), "revenue" = GREATEST(0, "revenue" + revenue_delta), "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'platform';
  RETURN NULL;
END $$;

CREATE FUNCTION dashboard_stat_payouts() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE delta BIGINT := CASE TG_OP WHEN 'INSERT' THEN 1 WHEN 'DELETE' THEN -1 ELSE 0 END;
BEGIN
  UPDATE "DashboardStat" SET "payouts" = GREATEST(0, "payouts" + delta), "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'platform';
  RETURN NULL;
END $$;

CREATE FUNCTION dashboard_stat_tickets() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE delta BIGINT := 0;
BEGIN
  IF TG_OP <> 'INSERT' AND OLD."status" IN ('OPEN','WAITING_SUPPORT') THEN delta := delta - 1; END IF;
  IF TG_OP <> 'DELETE' AND NEW."status" IN ('OPEN','WAITING_SUPPORT') THEN delta := delta + 1; END IF;
  UPDATE "DashboardStat" SET "openTickets" = GREATEST(0, "openTickets" + delta), "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'platform';
  RETURN NULL;
END $$;

CREATE FUNCTION dashboard_stat_wallet() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE credit_delta BIGINT := 0; debit_delta BIGINT := 0;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    IF OLD."direction" = 'CREDIT' THEN credit_delta := credit_delta - OLD."amount"; ELSE debit_delta := debit_delta - OLD."amount"; END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    IF NEW."direction" = 'CREDIT' THEN credit_delta := credit_delta + NEW."amount"; ELSE debit_delta := debit_delta + NEW."amount"; END IF;
  END IF;
  UPDATE "DashboardStat" SET "walletCredits" = GREATEST(0, "walletCredits" + credit_delta), "walletDebits" = GREATEST(0, "walletDebits" + debit_delta), "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'platform';
  RETURN NULL;
END $$;

CREATE TRIGGER dashboard_stat_users_trigger AFTER INSERT OR DELETE OR UPDATE OF "status" ON "User" FOR EACH ROW EXECUTE FUNCTION dashboard_stat_users();
CREATE TRIGGER dashboard_stat_teachers_trigger AFTER INSERT OR DELETE OR UPDATE OF "status" ON "Teacher" FOR EACH ROW EXECUTE FUNCTION dashboard_stat_teachers();
CREATE TRIGGER dashboard_stat_attempts_trigger AFTER INSERT OR DELETE OR UPDATE OF "status" ON "TestAttempt" FOR EACH ROW EXECUTE FUNCTION dashboard_stat_attempts();
CREATE TRIGGER dashboard_stat_bookings_trigger AFTER INSERT OR DELETE ON "Booking" FOR EACH ROW EXECUTE FUNCTION dashboard_stat_bookings();
CREATE TRIGGER dashboard_stat_payments_trigger AFTER INSERT OR DELETE OR UPDATE OF "status", "amount" ON "Payment" FOR EACH ROW EXECUTE FUNCTION dashboard_stat_payments();
CREATE TRIGGER dashboard_stat_payouts_trigger AFTER INSERT OR DELETE ON "PayoutBatch" FOR EACH ROW EXECUTE FUNCTION dashboard_stat_payouts();
CREATE TRIGGER dashboard_stat_tickets_trigger AFTER INSERT OR DELETE OR UPDATE OF "status" ON "Ticket" FOR EACH ROW EXECUTE FUNCTION dashboard_stat_tickets();
CREATE TRIGGER dashboard_stat_wallet_trigger AFTER INSERT OR DELETE OR UPDATE OF "direction", "amount" ON "WalletEntry" FOR EACH ROW EXECUTE FUNCTION dashboard_stat_wallet();
