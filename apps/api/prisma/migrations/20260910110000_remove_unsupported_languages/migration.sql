BEGIN;

CREATE TEMP TABLE "_RemovedLanguageIds" ON COMMIT DROP AS
SELECT "id"
FROM "Language"
WHERE "code" NOT IN ('en', 'de', 'fr');

-- Test attempts and results reference the test definition restrictively.
DELETE FROM "ExaminerReview"
WHERE "attemptId" IN (
  SELECT "id"
  FROM "TestAttempt"
  WHERE "testId" IN (
    SELECT "id"
    FROM "TestDefinition"
    WHERE "languageId" IN (SELECT "id" FROM "_RemovedLanguageIds")
  )
);

DELETE FROM "PlacementResult"
WHERE "testId" IN (
  SELECT "id"
  FROM "TestDefinition"
  WHERE "languageId" IN (SELECT "id" FROM "_RemovedLanguageIds")
);

DELETE FROM "TestAttempt"
WHERE "testId" IN (
  SELECT "id"
  FROM "TestDefinition"
  WHERE "languageId" IN (SELECT "id" FROM "_RemovedLanguageIds")
);

DELETE FROM "TestDefinition"
WHERE "languageId" IN (SELECT "id" FROM "_RemovedLanguageIds");

DELETE FROM "MatchingSession"
WHERE "languageId" IN (SELECT "id" FROM "_RemovedLanguageIds");

DELETE FROM "TeacherLanguage"
WHERE "languageId" IN (SELECT "id" FROM "_RemovedLanguageIds");

DELETE FROM "Course"
WHERE lower(trim("language")) IN (
  'spanish',
  'turkish',
  'italian',
  'portuguese',
  'korean',
  'arabic',
  'russian',
  'اسپانیایی',
  'ترکی',
  'ایتالیایی',
  'پرتغالی',
  'کره‌ای',
  'عربی',
  'روسی'
);

DELETE FROM "Language"
WHERE "id" IN (SELECT "id" FROM "_RemovedLanguageIds");

COMMIT;
