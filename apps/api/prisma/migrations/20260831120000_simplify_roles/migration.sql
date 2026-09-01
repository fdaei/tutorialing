-- Collapse the legacy operational roles into the four product roles while
-- preserving per-user permissions. Temporary columns avoid unsafe enum casts,
-- and duplicate grants are removed before rebuilding the composite keys.
CREATE TYPE "Role_next" AS ENUM ('STUDENT', 'INSTRUCTOR', 'SUPPORT', 'ADMIN');

ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_userId_role_fkey";
ALTER TABLE "UserRole" ADD COLUMN "roleNext" "Role_next";
ALTER TABLE "RolePermission" ADD COLUMN "roleNext" "Role_next";

UPDATE "UserRole" SET "roleNext" = CASE
  WHEN role::text = 'TEACHER' THEN 'INSTRUCTOR'::"Role_next"
  WHEN role::text = 'STAFF' THEN 'ADMIN'::"Role_next"
  WHEN role::text IN ('FINANCE', 'EXAMINER') THEN 'SUPPORT'::"Role_next"
  ELSE role::text::"Role_next"
END;
UPDATE "RolePermission" SET "roleNext" = CASE
  WHEN role::text = 'TEACHER' THEN 'INSTRUCTOR'::"Role_next"
  WHEN role::text = 'STAFF' THEN 'ADMIN'::"Role_next"
  WHEN role::text IN ('FINANCE', 'EXAMINER') THEN 'SUPPORT'::"Role_next"
  ELSE role::text::"Role_next"
END;

ALTER TABLE "TicketReply" ALTER COLUMN "authorRole" DROP DEFAULT;
ALTER TABLE "TicketReply" ALTER COLUMN "authorRole" TYPE "Role_next" USING CASE
  WHEN "authorRole"::text = 'TEACHER' THEN 'INSTRUCTOR'::"Role_next"
  WHEN "authorRole"::text = 'STAFF' THEN 'ADMIN'::"Role_next"
  WHEN "authorRole"::text IN ('FINANCE', 'EXAMINER') THEN 'SUPPORT'::"Role_next"
  ELSE "authorRole"::text::"Role_next"
END;
ALTER TABLE "TicketReply" ALTER COLUMN "authorRole" SET DEFAULT 'STUDENT'::"Role_next";
ALTER TABLE "TeacherPriceHistory" ALTER COLUMN "actorRole" TYPE "Role_next" USING CASE
  WHEN "actorRole"::text = 'TEACHER' THEN 'INSTRUCTOR'::"Role_next"
  WHEN "actorRole"::text = 'STAFF' THEN 'ADMIN'::"Role_next"
  WHEN "actorRole"::text IN ('FINANCE', 'EXAMINER') THEN 'SUPPORT'::"Role_next"
  ELSE "actorRole"::text::"Role_next"
END;

DELETE FROM "RolePermission" current
USING "RolePermission" duplicate
WHERE current.ctid < duplicate.ctid
  AND current."userId" = duplicate."userId"
  AND current."permissionId" = duplicate."permissionId"
  AND current."roleNext" = duplicate."roleNext";
DELETE FROM "UserRole" current
USING "UserRole" duplicate
WHERE current.ctid < duplicate.ctid
  AND current."userId" = duplicate."userId"
  AND current."roleNext" = duplicate."roleNext";

ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_pkey";
ALTER TABLE "UserRole" DROP CONSTRAINT "UserRole_pkey";
ALTER TABLE "RolePermission" DROP COLUMN role;
ALTER TABLE "UserRole" DROP COLUMN role;
ALTER TABLE "RolePermission" RENAME COLUMN "roleNext" TO role;
ALTER TABLE "UserRole" RENAME COLUMN "roleNext" TO role;
ALTER TYPE "Role" RENAME TO "Role_legacy";
ALTER TYPE "Role_next" RENAME TO "Role";

ALTER TABLE "UserRole" ALTER COLUMN role SET NOT NULL;
ALTER TABLE "RolePermission" ALTER COLUMN role SET NOT NULL;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId", role);
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("userId", role, "permissionId");
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_userId_role_fkey"
  FOREIGN KEY ("userId", role) REFERENCES "UserRole"("userId", role) ON DELETE CASCADE ON UPDATE CASCADE;
DROP TYPE "Role_legacy";
