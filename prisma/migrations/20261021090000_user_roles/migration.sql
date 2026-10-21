-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('FREELANCER', 'CLIENT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" "UserRole";

-- Existing project creators are freelancers. Accounts without a project are
-- treated as clients so this migration remains safe for existing installations.
UPDATE "User"
SET "role" = CASE
    WHEN EXISTS (
        SELECT 1 FROM "Project" WHERE "Project"."creatorId" = "User"."id"
    ) THEN 'FREELANCER'::"UserRole"
    ELSE 'CLIENT'::"UserRole"
END;

ALTER TABLE "User" ALTER COLUMN "role" SET NOT NULL;
