CREATE TYPE "ChangeRequestStatus" AS ENUM ('REQUESTED', 'PROPOSED', 'ACCEPTED', 'REJECTED');

CREATE TABLE "ChangeRequest" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "baseAgreementVersionId" UUID NOT NULL,
    "proposedVersionId" UUID,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChangeRequest_proposedVersionId_key" ON "ChangeRequest"("proposedVersionId");
CREATE INDEX "ChangeRequest_projectId_createdAt_id_idx" ON "ChangeRequest"("projectId", "createdAt", "id");
CREATE INDEX "ChangeRequest_requestedById_idx" ON "ChangeRequest"("requestedById");

ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_requestedById_fkey"
FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_proposedVersionId_fkey"
FOREIGN KEY ("proposedVersionId") REFERENCES "AgreementVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
