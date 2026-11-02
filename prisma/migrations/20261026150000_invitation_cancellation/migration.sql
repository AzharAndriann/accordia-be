CREATE TYPE "MembershipRemovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Invitation"
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "acceptedById" UUID,
ADD COLUMN "removalStatus" "MembershipRemovalStatus",
ADD COLUMN "removalRequestedAt" TIMESTAMP(3),
ADD COLUMN "removalRespondedAt" TIMESTAMP(3);

CREATE INDEX "Invitation_acceptedById_removalStatus_idx"
ON "Invitation"("acceptedById", "removalStatus");
