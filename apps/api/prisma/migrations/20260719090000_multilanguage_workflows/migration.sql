-- Dynamic educational languages and complete operational workflows.
ALTER TYPE "ReviewStatus" ADD VALUE IF NOT EXISTS 'NEEDS_REVISION';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS' AFTER 'OPEN';

CREATE TYPE "LanguageDirection" AS ENUM ('LTR', 'RTL');
CREATE TYPE "ProficiencySystem" AS ENUM ('CEFR', 'CUSTOM');
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_REVISION');
CREATE TYPE "PriceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'COUNTER_OFFER', 'APPROVED', 'REJECTED');
CREATE TYPE "AnswerReviewStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'NEEDS_REVISION');
CREATE TYPE "TicketMessageType" AS ENUM ('USER_MESSAGE', 'STAFF_REPLY', 'INTERNAL_NOTE', 'SYSTEM');
CREATE TYPE "TicketDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL', 'SYSTEM');

CREATE TABLE "Language" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "nameFa" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "nativeName" TEXT NOT NULL,
  "flag" TEXT,
  "direction" "LanguageDirection" NOT NULL DEFAULT 'LTR',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  "proficiencySystem" "ProficiencySystem" NOT NULL DEFAULT 'CEFR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Language_code_key" ON "Language"("code");
CREATE INDEX "Language_active_order_idx" ON "Language"("active", "order");

INSERT INTO "Language" ("id","code","nameFa","nameEn","nativeName","flag","direction","order","updatedAt") VALUES
('lang-en','en','انگلیسی','English','English','🇬🇧','LTR',1,CURRENT_TIMESTAMP),
('lang-de','de','آلمانی','German','Deutsch','🇩🇪','LTR',2,CURRENT_TIMESTAMP),
('lang-es','es','اسپانیایی','Spanish','Español','🇪🇸','LTR',3,CURRENT_TIMESTAMP),
('lang-tr','tr','ترکی','Turkish','Türkçe','🇹🇷','LTR',4,CURRENT_TIMESTAMP),
('lang-fr','fr','فرانسوی','French','Français','🇫🇷','LTR',5,CURRENT_TIMESTAMP),
('lang-it','it','ایتالیایی','Italian','Italiano','🇮🇹','LTR',6,CURRENT_TIMESTAMP),
('lang-pt','pt','پرتغالی','Portuguese','Português','🇵🇹','LTR',7,CURRENT_TIMESTAMP),
('lang-ko','ko','کره‌ای','Korean','한국어','🇰🇷','LTR',8,CURRENT_TIMESTAMP),
('lang-ar','ar','عربی','Arabic','العربية','🇸🇦','RTL',9,CURRENT_TIMESTAMP),
('lang-ru','ru','روسی','Russian','Русский','🇷🇺','LTR',10,CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
ALTER TABLE "Language" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Teacher profile, pricing, and teaching languages.
ALTER TABLE "Teacher"
  ADD COLUMN "gender" TEXT,
  ADD COLUMN "regularPrice" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "trialDuration" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "proposedTrialPrice" INTEGER,
  ADD COLUMN "proposedRegularPrice" INTEGER,
  ADD COLUMN "approvedTrialPrice" INTEGER,
  ADD COLUMN "approvedRegularPrice" INTEGER,
  ADD COLUMN "counterTrialPrice" INTEGER,
  ADD COLUMN "counterRegularPrice" INTEGER,
  ADD COLUMN "priceStatus" "PriceStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "priceReviewedById" TEXT,
  ADD COLUMN "priceReviewedAt" TIMESTAMP(3),
  ADD COLUMN "priceReviewNote" TEXT;

UPDATE "Teacher"
SET "regularPrice" = CASE WHEN "trialPrice" > 0 THEN "trialPrice" * 2 ELSE 0 END,
    "approvedTrialPrice" = NULLIF("trialPrice", 0),
    "approvedRegularPrice" = NULLIF(CASE WHEN "trialPrice" > 0 THEN "trialPrice" * 2 ELSE 0 END, 0),
    "priceStatus" = CASE WHEN "status" = 'APPROVED' AND "trialPrice" > 0 THEN 'APPROVED'::"PriceStatus" ELSE 'DRAFT'::"PriceStatus" END;

CREATE TABLE "TeacherLanguage" (
  "teacherId" TEXT NOT NULL,
  "languageId" TEXT NOT NULL,
  "levels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "specialties" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherLanguage_pkey" PRIMARY KEY ("teacherId", "languageId")
);
CREATE INDEX "TeacherLanguage_languageId_active_idx" ON "TeacherLanguage"("languageId", "active");
ALTER TABLE "TeacherLanguage" ADD CONSTRAINT "TeacherLanguage_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherLanguage" ADD CONSTRAINT "TeacherLanguage_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "TeacherLanguage" ("teacherId","languageId","levels","specialties")
SELECT "id", 'lang-en', ARRAY['A1','A2','B1','B2','C1','C2']::TEXT[], "specialties"
FROM "Teacher"
ON CONFLICT ("teacherId","languageId") DO NOTHING;

CREATE TABLE "TeacherPriceHistory" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorRole" "Role" NOT NULL,
  "action" TEXT NOT NULL,
  "status" "PriceStatus" NOT NULL,
  "proposedTrialPrice" INTEGER,
  "proposedRegularPrice" INTEGER,
  "approvedTrialPrice" INTEGER,
  "approvedRegularPrice" INTEGER,
  "counterTrialPrice" INTEGER,
  "counterRegularPrice" INTEGER,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherPriceHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TeacherPriceHistory_teacherId_createdAt_idx" ON "TeacherPriceHistory"("teacherId","createdAt");
ALTER TABLE "TeacherPriceHistory" ADD CONSTRAINT "TeacherPriceHistory_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherPriceHistory" ADD CONSTRAINT "TeacherPriceHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_priceReviewedById_fkey" FOREIGN KEY ("priceReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Verification documents use their own complete lifecycle.
ALTER TABLE "VerificationItem" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "VerificationItem" ALTER COLUMN "status" TYPE "DocumentStatus"
USING (CASE "status"::text
  WHEN 'PENDING' THEN 'SUBMITTED'
  WHEN 'APPROVED' THEN 'APPROVED'
  WHEN 'REJECTED' THEN 'REJECTED'
  ELSE 'DRAFT'
END)::"DocumentStatus";
ALTER TABLE "VerificationItem" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
ALTER TABLE "VerificationItem"
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "submittedAt" TIMESTAMP(3);
UPDATE "VerificationItem" SET "submittedAt" = "createdAt" WHERE "status" <> 'DRAFT';

-- Availability rules and blocked period visibility.
CREATE UNIQUE INDEX "AvailabilityOverride_teacherId_date_key" ON "AvailabilityOverride"("teacherId", "date");
ALTER TABLE "AvailabilityRule" ADD COLUMN "lessonDuration" INTEGER, ADD COLUMN "breakMinutes" INTEGER;
ALTER TABLE "BlockedPeriod" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "BlockedPeriod" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "BlockedPeriod" SET "updatedAt" = CURRENT_TIMESTAMP;
ALTER TABLE "BlockedPeriod" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "BlockedPeriod" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Moderated reviews tied to a successful booking.
ALTER TABLE "Review"
  ADD COLUMN "moderationStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "moderatedById" TEXT,
  ADD COLUMN "moderatedAt" TIMESTAMP(3),
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "teacherResponse" TEXT,
  ADD COLUMN "respondedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "Review" SET "moderationStatus" = CASE WHEN "published" THEN 'APPROVED'::"ReviewStatus" ELSE 'PENDING'::"ReviewStatus" END, "updatedAt" = CURRENT_TIMESTAMP;
ALTER TABLE "Review" ALTER COLUMN "published" SET DEFAULT false;
ALTER TABLE "Review" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "Review" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Review" ADD CONSTRAINT "Review_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Language-specific tests and persistent audio references.
ALTER TABLE "TestDefinition" ADD COLUMN "languageId" TEXT NOT NULL DEFAULT 'lang-en', ADD COLUMN "level" TEXT;
ALTER TABLE "TestDefinition" ADD CONSTRAINT "TestDefinition_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "TestDefinition_languageId_published_idx" ON "TestDefinition"("languageId","published");
ALTER TABLE "Passage" ADD CONSTRAINT "Passage_audioFileId_fkey" FOREIGN KEY ("audioFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Question" ADD COLUMN "audioFileId" TEXT;
ALTER TABLE "Question" ADD CONSTRAINT "Question_audioFileId_fkey" FOREIGN KEY ("audioFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TestAnswer"
  ADD COLUMN "reviewStatus" "AnswerReviewStatus",
  ADD COLUMN "reviewCriteria" JSONB,
  ADD COLUMN "feedbackFa" TEXT,
  ADD COLUMN "feedbackEn" TEXT,
  ADD COLUMN "reviewerId" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "TestAnswer" ADD CONSTRAINT "TestAnswer_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "TestAnswer_reviewStatus_updatedAt_idx" ON "TestAnswer"("reviewStatus","updatedAt");
UPDATE "TestAnswer" a SET "reviewStatus"='PENDING'
FROM "Question" q WHERE a."questionId"=q."id" AND q."type" IN ('essay','recording') AND a."finalScore" IS NULL;

ALTER TABLE "ExaminerReview"
  ADD COLUMN "answerId" TEXT,
  ADD COLUMN "feedbackFa" TEXT,
  ADD COLUMN "feedbackEn" TEXT,
  ADD COLUMN "status" "AnswerReviewStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "reviewedAt" TIMESTAMP(3);
UPDATE "ExaminerReview" SET "status"=CASE WHEN "approved" THEN 'APPROVED'::"AnswerReviewStatus" ELSE 'NEEDS_REVISION'::"AnswerReviewStatus" END, "reviewedAt"="createdAt";
ALTER TABLE "ExaminerReview" ADD CONSTRAINT "ExaminerReview_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "TestAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ExaminerReview_attemptId_status_idx" ON "ExaminerReview"("attemptId","status");
CREATE INDEX "ExaminerReview_answerId_idx" ON "ExaminerReview"("answerId");

-- Complete matching questionnaire, scoped by educational language.
ALTER TABLE "MatchingSession"
  ADD COLUMN "languageId" TEXT NOT NULL DEFAULT 'lang-en',
  ADD COLUMN "currentLevel" TEXT,
  ADD COLUMN "learningGoal" TEXT,
  ADD COLUMN "targetLevel" TEXT,
  ADD COLUMN "suitableDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "preferredTime" TEXT,
  ADD COLUMN "preferredTeacherGender" TEXT,
  ADD COLUMN "trialRequired" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "classType" TEXT NOT NULL DEFAULT 'private';
ALTER TABLE "MatchingSession" ADD CONSTRAINT "MatchingSession_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "MatchingSession_languageId_createdAt_idx" ON "MatchingSession"("languageId","createdAt");

-- Ticket ownership, message identity, status and assignment history.
ALTER TABLE "Ticket" ADD COLUMN "slaDueAt" TIMESTAMP(3), ADD COLUMN "lastReplyAt" TIMESTAMP(3);
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Ticket_status_updatedAt_idx" ON "Ticket"("status","updatedAt");
CREATE INDEX "Ticket_assignedToId_status_idx" ON "Ticket"("assignedToId","status");

ALTER TABLE "TicketReply"
  ADD COLUMN "authorRole" "Role" NOT NULL DEFAULT 'STUDENT',
  ADD COLUMN "direction" "TicketDirection" NOT NULL DEFAULT 'INBOUND',
  ADD COLUMN "messageType" "TicketMessageType" NOT NULL DEFAULT 'USER_MESSAGE';
UPDATE "TicketReply" r SET
  "authorRole" = CASE WHEN r."authorId" = t."userId" THEN 'STUDENT'::"Role" ELSE 'SUPPORT'::"Role" END,
  "direction" = CASE WHEN r."internal" THEN 'INTERNAL'::"TicketDirection" WHEN r."authorId" = t."userId" THEN 'INBOUND'::"TicketDirection" ELSE 'OUTBOUND'::"TicketDirection" END,
  "messageType" = CASE WHEN r."internal" THEN 'INTERNAL_NOTE'::"TicketMessageType" WHEN r."authorId" = t."userId" THEN 'USER_MESSAGE'::"TicketMessageType" ELSE 'STAFF_REPLY'::"TicketMessageType" END
FROM "Ticket" t WHERE r."ticketId" = t."id";
ALTER TABLE "TicketReply" ADD CONSTRAINT "TicketReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "TicketReply_ticketId_createdAt_idx" ON "TicketReply"("ticketId","createdAt");

CREATE TABLE "TicketStatusHistory" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "fromStatus" "TicketStatus",
  "toStatus" "TicketStatus" NOT NULL,
  "actorId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketStatusHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TicketStatusHistory_ticketId_createdAt_idx" ON "TicketStatusHistory"("ticketId","createdAt");
ALTER TABLE "TicketStatusHistory" ADD CONSTRAINT "TicketStatusHistory_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketStatusHistory" ADD CONSTRAINT "TicketStatusHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "TicketAssignmentHistory" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "fromAssigneeId" TEXT,
  "toAssigneeId" TEXT,
  "actorId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketAssignmentHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TicketAssignmentHistory_ticketId_createdAt_idx" ON "TicketAssignmentHistory"("ticketId","createdAt");
ALTER TABLE "TicketAssignmentHistory" ADD CONSTRAINT "TicketAssignmentHistory_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketAssignmentHistory" ADD CONSTRAINT "TicketAssignmentHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
