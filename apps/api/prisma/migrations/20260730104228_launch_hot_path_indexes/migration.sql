-- CreateIndex
CREATE INDEX "Review_teacherId_moderationStatus_published_idx" ON "Review"("teacherId", "moderationStatus", "published");

-- CreateIndex
CREATE INDEX "Teacher_status_approvedAt_idx" ON "Teacher"("status", "approvedAt");

-- CreateIndex
CREATE INDEX "Teacher_status_rating_idx" ON "Teacher"("status", "rating");
