-- AlterTable
ALTER TABLE "Order" ADD COLUMN "guestAccessTokenHash" TEXT,
ADD COLUMN "guestAccessExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_guestAccessTokenHash_idx" ON "Order"("guestAccessTokenHash");
