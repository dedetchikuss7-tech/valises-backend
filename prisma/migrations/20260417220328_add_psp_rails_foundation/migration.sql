-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "payoutMethodType" "PayoutMethodType",
ADD COLUMN     "railProvider" "PaymentRailProvider";

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "payinMethodType" "PaymentMethodType",
ADD COLUMN     "payinProviderReference" TEXT,
ADD COLUMN     "payinRailProvider" "PaymentRailProvider",
ADD COLUMN     "paymentConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "paymentMetadata" JSONB;

-- CreateIndex
CREATE INDEX "Payout_railProvider_idx" ON "Payout"("railProvider");

-- CreateIndex
CREATE INDEX "Payout_payoutMethodType_idx" ON "Payout"("payoutMethodType");

-- CreateIndex
CREATE INDEX "Transaction_payinRailProvider_idx" ON "Transaction"("payinRailProvider");

-- CreateIndex
CREATE INDEX "Transaction_paymentConfirmedAt_idx" ON "Transaction"("paymentConfirmedAt");
