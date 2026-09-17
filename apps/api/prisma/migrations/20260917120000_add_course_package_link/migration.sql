-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "packageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Course_packageId_key" ON "Course"("packageId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;
