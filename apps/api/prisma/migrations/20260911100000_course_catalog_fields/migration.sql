-- Catalog metadata for the public Lingo Stick site.
--
-- `Course` used to describe only self-paced video products (chapters + lessons
-- played through the course player). The institute site also sells scheduled
-- live classes held on Google Meet or Skyroom, which have no chapters at all.
-- `format` separates the two so publishing rules can differ per format, and the
-- remaining columns carry the marketing detail the landing/course pages render.

CREATE TYPE "CourseFormat" AS ENUM ('SELF_PACED', 'LIVE_ONLINE');
CREATE TYPE "CourseDelivery" AS ENUM ('ONLINE', 'IN_PERSON', 'HYBRID');
CREATE TYPE "CoursePlatform" AS ENUM ('GOOGLE_MEET', 'SKYROOM');

ALTER TABLE "Course"
  ADD COLUMN "summaryFa" TEXT,
  ADD COLUMN "summaryEn" TEXT,
  ADD COLUMN "category" TEXT,
  ADD COLUMN "format" "CourseFormat" NOT NULL DEFAULT 'SELF_PACED',
  ADD COLUMN "delivery" "CourseDelivery" NOT NULL DEFAULT 'ONLINE',
  ADD COLUMN "platform" "CoursePlatform",
  ADD COLUMN "durationFa" TEXT,
  ADD COLUMN "durationEn" TEXT,
  ADD COLUMN "audienceFa" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "audienceEn" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "outcomesFa" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "outcomesEn" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "consultationOnly" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Course_published_sortOrder_idx" ON "Course" ("published", "sortOrder");
