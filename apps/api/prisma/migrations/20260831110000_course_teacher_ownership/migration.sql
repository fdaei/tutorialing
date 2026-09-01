ALTER TABLE "Course" ADD COLUMN "teacherId" TEXT;

UPDATE "Course" AS course
SET "teacherId" = teacher.id
FROM "Teacher" AS teacher
WHERE course."teacherName" IN (teacher."nameFa", teacher."nameEn");

CREATE INDEX "Course_teacherId_createdAt_idx" ON "Course"("teacherId", "createdAt");

ALTER TABLE "Course"
ADD CONSTRAINT "Course_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
