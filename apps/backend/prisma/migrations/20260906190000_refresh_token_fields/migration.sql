-- AlterTable
ALTER TABLE "User" ADD COLUMN "refreshTokenDigest" TEXT,
ADD COLUMN "refreshTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_refreshTokenDigest_key" ON "User"("refreshTokenDigest");