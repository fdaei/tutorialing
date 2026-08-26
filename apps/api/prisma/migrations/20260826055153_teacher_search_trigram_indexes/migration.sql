-- PERF-301: enable trigram matching so ILIKE '%term%' can be satisfied by a
-- GIN index instead of a sequential scan. pg_trgm is a standard, "trusted"
-- (PG13+) extension shipped in contrib; IF NOT EXISTS makes this idempotent
-- if it's already installed in the target database.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "Teacher_status_approvedTrialPrice_idx" ON "Teacher"("status", "approvedTrialPrice");

-- CreateIndex
CREATE INDEX "Teacher_nameFa_idx" ON "Teacher" USING GIN ("nameFa" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Teacher_nameEn_idx" ON "Teacher" USING GIN ("nameEn" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Teacher_bioFa_idx" ON "Teacher" USING GIN ("bioFa" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Teacher_bioEn_idx" ON "Teacher" USING GIN ("bioEn" gin_trgm_ops);
