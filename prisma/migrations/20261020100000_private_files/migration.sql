CREATE TYPE "FileStatus" AS ENUM ('READY', 'FAILED');

CREATE TABLE "File" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "uploaderId" UUID NOT NULL,
    "storageKey" VARCHAR(100) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(50) NOT NULL,
    "size" INTEGER NOT NULL,
    "checksum" CHAR(64) NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'READY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "File_storageKey_key" ON "File"("storageKey");
CREATE INDEX "File_projectId_createdAt_idx" ON "File"("projectId", "createdAt");
CREATE INDEX "File_uploaderId_idx" ON "File"("uploaderId");
ALTER TABLE "File" ADD CONSTRAINT "File_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "File" ADD CONSTRAINT "File_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
