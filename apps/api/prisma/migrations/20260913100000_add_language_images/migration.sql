ALTER TABLE "Language"
  ADD COLUMN "imageId" TEXT;

ALTER TABLE "Language"
  ADD CONSTRAINT "Language_imageId_fkey"
  FOREIGN KEY ("imageId") REFERENCES "StoredFile"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
