-- The immediately preceding blog-system migration already creates this
-- implicit Prisma join table. Keep this historical migration idempotent so a
-- fresh database and databases created from the earlier draft both converge.
CREATE TABLE IF NOT EXISTS "_BlogPostToBlogTag" ("A" TEXT NOT NULL, "B" TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS "_BlogPostToBlogTag_AB_unique" ON "_BlogPostToBlogTag"("A", "B");
CREATE INDEX IF NOT EXISTS "_BlogPostToBlogTag_B_index" ON "_BlogPostToBlogTag"("B");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_BlogPostToBlogTag_A_fkey') THEN
    ALTER TABLE "_BlogPostToBlogTag" ADD CONSTRAINT "_BlogPostToBlogTag_A_fkey"
      FOREIGN KEY ("A") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_BlogPostToBlogTag_B_fkey') THEN
    ALTER TABLE "_BlogPostToBlogTag" ADD CONSTRAINT "_BlogPostToBlogTag_B_fkey"
      FOREIGN KEY ("B") REFERENCES "BlogTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
