-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('CARD', 'MOBILE_MONEY', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "PayoutMethodType" AS ENUM ('MOBILE_MONEY', 'BANK_PAYOUT', 'MANUAL_PAYOUT');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "deliveryCodeConsumedAt" TIMESTAMP(3),
ADD COLUMN     "deliveryCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "deliveryCodeGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "deliveryCodeHash" TEXT,
ADD COLUMN     "deliveryCodeSalt" TEXT,
ADD COLUMN     "deliveryConfirmedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "corridor_pricing_payment_config" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Transaction_deliveryCodeExpiresAt_idx" ON "Transaction"("deliveryCodeExpiresAt");
