CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'REVISION_REQUESTED', 'ACCEPTED');

CREATE TABLE "Delivery" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "agreementVersionId" UUID NOT NULL,
    "submittedById" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "links" TEXT[],
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DeliveryFile" (
    "deliveryId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    CONSTRAINT "DeliveryFile_pkey" PRIMARY KEY ("deliveryId", "fileId")
);
CREATE TABLE "RevisionRequest" (
    "id" UUID NOT NULL,
    "deliveryId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RevisionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Delivery_projectId_submittedAt_id_idx" ON "Delivery"("projectId", "submittedAt", "id");
CREATE INDEX "Delivery_agreementVersionId_idx" ON "Delivery"("agreementVersionId");
CREATE INDEX "Delivery_submittedById_idx" ON "Delivery"("submittedById");
CREATE UNIQUE INDEX "Delivery_one_pending_per_project" ON "Delivery"("projectId") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "DeliveryFile_fileId_key" ON "DeliveryFile"("fileId");
CREATE UNIQUE INDEX "RevisionRequest_deliveryId_key" ON "RevisionRequest"("deliveryId");
CREATE INDEX "RevisionRequest_requestedById_idx" ON "RevisionRequest"("requestedById");

ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_agreementVersionId_fkey" FOREIGN KEY ("agreementVersionId") REFERENCES "AgreementVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryFile" ADD CONSTRAINT "DeliveryFile_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryFile" ADD CONSTRAINT "DeliveryFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RevisionRequest" ADD CONSTRAINT "RevisionRequest_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevisionRequest" ADD CONSTRAINT "RevisionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
