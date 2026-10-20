CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "amountRupiah" DECIMAL(18,0) NOT NULL,
    "submittedById" UUID NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" UUID,
    "note" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PaymentFile" (
    "paymentId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    CONSTRAINT "PaymentFile_pkey" PRIMARY KEY ("paymentId", "fileId")
);
CREATE INDEX "Payment_projectId_createdAt_id_idx" ON "Payment"("projectId", "createdAt", "id");
CREATE INDEX "Payment_submittedById_idx" ON "Payment"("submittedById");
CREATE INDEX "Payment_reviewedById_idx" ON "Payment"("reviewedById");
CREATE UNIQUE INDEX "PaymentFile_fileId_key" ON "PaymentFile"("fileId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentFile" ADD CONSTRAINT "PaymentFile_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentFile" ADD CONSTRAINT "PaymentFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
