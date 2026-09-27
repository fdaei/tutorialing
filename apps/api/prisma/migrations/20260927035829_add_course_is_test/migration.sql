-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DashboardStat" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "_BlogPostToBlogTag" ADD CONSTRAINT "_BlogPostToBlogTag_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_BlogPostToBlogTag_AB_unique";
