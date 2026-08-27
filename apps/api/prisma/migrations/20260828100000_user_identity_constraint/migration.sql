-- Both identity columns are nullable, so nothing at the database level stopped a
-- `User` row from existing with neither a phone nor a Google subject. Such a row
-- can never be signed into and never be matched to an inbound login, but it can
-- still own bookings, payments and a wallet balance.
--
-- Added NOT VALID first so the ACCESS EXCLUSIVE lock is taken only for the
-- catalogue change and not for a full-table scan; VALIDATE then checks the
-- existing rows under a weaker SHARE UPDATE EXCLUSIVE lock that does not block
-- reads or writes. Every row was verified to satisfy this before the migration
-- was written, so the validation is expected to pass immediately.
ALTER TABLE "User"
  ADD CONSTRAINT "User_has_identity"
  CHECK ("phone" IS NOT NULL OR "googleSubject" IS NOT NULL) NOT VALID;

ALTER TABLE "User" VALIDATE CONSTRAINT "User_has_identity";
