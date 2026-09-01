CREATE TYPE "CourseLessonType" AS ENUM ('VIDEO', 'AUDIO', 'TEXT', 'QUIZ');

ALTER TABLE "CourseEnrollment" ADD COLUMN "lastLessonId" TEXT;

CREATE TABLE "CourseChapter" (
  "id" TEXT NOT NULL, "courseId" TEXT NOT NULL, "titleFa" TEXT NOT NULL,
  "titleEn" TEXT NOT NULL, "order" INTEGER NOT NULL, "published" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseChapter_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CourseLesson" (
  "id" TEXT NOT NULL, "chapterId" TEXT NOT NULL, "titleFa" TEXT NOT NULL, "titleEn" TEXT NOT NULL,
  "descriptionFa" TEXT, "descriptionEn" TEXT, "type" "CourseLessonType" NOT NULL,
  "content" JSONB, "mediaUrl" TEXT, "durationSeconds" INTEGER NOT NULL DEFAULT 0,
  "order" INTEGER NOT NULL, "preview" BOOLEAN NOT NULL DEFAULT false, "published" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseLesson_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CourseLessonAttachment" (
  "id" TEXT NOT NULL, "lessonId" TEXT NOT NULL, "title" TEXT NOT NULL, "url" TEXT NOT NULL,
  "mimeType" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseLessonAttachment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CourseLessonProgress" (
  "id" TEXT NOT NULL, "enrollmentId" TEXT NOT NULL, "lessonId" TEXT NOT NULL,
  "positionSeconds" INTEGER NOT NULL DEFAULT 0, "completedAt" TIMESTAMP(3),
  "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseLessonProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CourseChapter_courseId_order_key" ON "CourseChapter"("courseId","order");
CREATE UNIQUE INDEX "CourseLesson_chapterId_order_key" ON "CourseLesson"("chapterId","order");
CREATE INDEX "CourseLesson_chapterId_published_order_idx" ON "CourseLesson"("chapterId","published","order");
CREATE INDEX "CourseLessonAttachment_lessonId_idx" ON "CourseLessonAttachment"("lessonId");
CREATE UNIQUE INDEX "CourseLessonProgress_enrollmentId_lessonId_key" ON "CourseLessonProgress"("enrollmentId","lessonId");
CREATE INDEX "CourseLessonProgress_enrollmentId_completedAt_idx" ON "CourseLessonProgress"("enrollmentId","completedAt");
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_lastLessonId_fkey" FOREIGN KEY ("lastLessonId") REFERENCES "CourseLesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourseChapter" ADD CONSTRAINT "CourseChapter_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseLesson" ADD CONSTRAINT "CourseLesson_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "CourseChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseLessonAttachment" ADD CONSTRAINT "CourseLessonAttachment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseLessonProgress" ADD CONSTRAINT "CourseLessonProgress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CourseEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseLessonProgress" ADD CONSTRAINT "CourseLessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
