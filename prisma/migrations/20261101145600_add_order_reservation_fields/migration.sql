-- AlterTable
ALTER TABLE "Order" ADD COLUMN "reservationExpiresAt" TIMESTAMP(3),
ADD COLUMN "stockReserved" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "couponReleased" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Order_reservationExpiresAt_idx" ON "Order"("reservationExpiresAt");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");
