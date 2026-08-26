-- PERF-304: AdminRepository.getUsers() orders by createdAt while
-- SearchService.users() orders by updatedAt. Both default listings are
-- unfiltered, so standalone sort indexes cover the real query shapes better
-- than the audit's original [status, updatedAt] hypothesis.
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

CREATE INDEX "User_updatedAt_idx" ON "User"("updatedAt");
