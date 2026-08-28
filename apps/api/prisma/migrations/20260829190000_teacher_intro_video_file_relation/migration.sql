ALTER TABLE "Teacher" ADD COLUMN "introVideoFileId" TEXT;

UPDATE "Teacher" AS teacher
SET "introVideoFileId" = file.id
FROM "StoredFile" AS file
WHERE teacher."introVideoKey" = file.key
  AND file.purpose = 'teacher-intro-video';

CREATE UNIQUE INDEX "Teacher_introVideoFileId_key" ON "Teacher"("introVideoFileId");

ALTER TABLE "Teacher"
ADD CONSTRAINT "Teacher_introVideoFileId_fkey"
FOREIGN KEY ("introVideoFileId") REFERENCES "StoredFile"(id)
ON DELETE SET NULL ON UPDATE CASCADE;
