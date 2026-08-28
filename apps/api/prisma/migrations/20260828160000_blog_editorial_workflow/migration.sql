ALTER TYPE "BlogPostStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW' BEFORE 'PUBLISHED';
ALTER TYPE "BlogPostStatus" ADD VALUE IF NOT EXISTS 'APPROVED' BEFORE 'PUBLISHED';
ALTER TYPE "BlogPostStatus" ADD VALUE IF NOT EXISTS 'REJECTED' BEFORE 'PUBLISHED';

ALTER TABLE "BlogPost"
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "rejectionReason" TEXT;

CREATE INDEX "BlogPost_authorId_status_updatedAt_idx" ON "BlogPost"("authorId", "status", "updatedAt");
CREATE INDEX "BlogPost_status_submittedAt_idx" ON "BlogPost"("status", "submittedAt");
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BlogComment" ADD COLUMN "parentId" TEXT;
CREATE INDEX "BlogComment_parentId_status_createdAt_idx" ON "BlogComment"("parentId", "status", "createdAt");
ALTER TABLE "BlogComment" ADD CONSTRAINT "BlogComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BlogComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
