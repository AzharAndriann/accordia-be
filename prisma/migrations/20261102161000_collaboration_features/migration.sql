CREATE TABLE "UserConsent" (
 "id" UUID NOT NULL PRIMARY KEY, "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "termsVersion" VARCHAR(40) NOT NULL, "privacyVersion" VARCHAR(40) NOT NULL,
 "birthDate" DATE NOT NULL, "declaredCapacity" BOOLEAN NOT NULL, "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "UserConsent_userId_termsVersion_privacyVersion_key" ON "UserConsent"("userId", "termsVersion", "privacyVersion");
CREATE TABLE "PushDevice" (
 "id" UUID NOT NULL PRIMARY KEY, "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "sessionId" UUID NOT NULL, "token" VARCHAR(255) NOT NULL, "platform" VARCHAR(10) NOT NULL,
 "enabled" BOOLEAN NOT NULL DEFAULT true, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "PushDevice_token_key" ON "PushDevice"("token");
CREATE INDEX "PushDevice_userId_enabled_idx" ON "PushDevice"("userId", "enabled");
CREATE INDEX "PushDevice_sessionId_idx" ON "PushDevice"("sessionId");
CREATE TABLE "NotificationJob" (
 "id" UUID NOT NULL PRIMARY KEY, "key" VARCHAR(255) NOT NULL, "channel" VARCHAR(10) NOT NULL,
 "recipient" VARCHAR(255) NOT NULL, "userId" UUID, "sessionId" UUID, "projectId" UUID, "invitationId" UUID,
 "payload" JSONB NOT NULL, "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
 "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lockedAt" TIMESTAMP(3), "receiptId" VARCHAR(255),
 "lastError" VARCHAR(100), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "NotificationJob_key_key" ON "NotificationJob"("key");
CREATE INDEX "NotificationJob_status_availableAt_idx" ON "NotificationJob"("status", "availableAt");
CREATE TYPE "ProjectRequestType" AS ENUM ('CANCELLATION', 'DISPUTE');
CREATE TYPE "ProjectRequestStatus" AS ENUM ('OPEN', 'PROPOSED', 'APPROVED', 'REJECTED', 'WITHDRAWN');
CREATE TABLE "ProjectRequest" (
 "id" UUID NOT NULL PRIMARY KEY, "projectId" UUID NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
 "type" "ProjectRequestType" NOT NULL, "status" "ProjectRequestStatus" NOT NULL DEFAULT 'OPEN',
 "reason" TEXT NOT NULL, "requestedById" UUID NOT NULL, "respondentId" UUID, "resolution" TEXT, "proposedById" UUID,
 "respondedById" UUID, "responseReason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, "resolvedAt" TIMESTAMP(3)
);
CREATE INDEX "ProjectRequest_projectId_createdAt_id_idx" ON "ProjectRequest"("projectId", "createdAt", "id");
CREATE UNIQUE INDEX "ProjectRequest_one_open_per_type" ON "ProjectRequest"("projectId", "type") WHERE "status" IN ('OPEN', 'PROPOSED');
