/*
  Warnings:

  - The values [PENDING] on the enum `KycStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [UNPAID,AUTHORIZED,CAPTURED,REFUNDED] on the enum `PaymentStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [SENDER,TRAVELER] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - The values [INITIATED,RESERVED] on the enum `TransactionStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `escrowHeld` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `platformCommission` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `platformRevenue` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `totalAmount` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `travelerPayout` on the `Transaction` table. All the data in the column will be lost.
  - Added the required column `amount` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "KycStatus_new" AS ENUM ('NOT_STARTED', 'VERIFIED', 'REJECTED');
ALTER TABLE "public"."User" ALTER COLUMN "kycStatus" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "kycStatus" TYPE "KycStatus_new" USING ("kycStatus"::text::"KycStatus_new");
ALTER TYPE "KycStatus" RENAME TO "KycStatus_old";
ALTER TYPE "KycStatus_new" RENAME TO "KycStatus";
DROP TYPE "public"."KycStatus_old";
ALTER TABLE "User" ALTER COLUMN "kycStatus" SET DEFAULT 'NOT_STARTED';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
ALTER TABLE "public"."Transaction" ALTER COLUMN "paymentStatus" DROP DEFAULT;
ALTER TABLE "Transaction" ALTER COLUMN "paymentStatus" TYPE "PaymentStatus_new" USING ("paymentStatus"::text::"PaymentStatus_new");
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "public"."PaymentStatus_old";
ALTER TABLE "Transaction" ALTER COLUMN "paymentStatus" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('USER', 'ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TransactionStatus_new" AS ENUM ('CREATED', 'PAID', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'DISPUTED');
ALTER TABLE "public"."Transaction" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Transaction" ALTER COLUMN "status" TYPE "TransactionStatus_new" USING ("status"::text::"TransactionStatus_new");
ALTER TYPE "TransactionStatus" RENAME TO "TransactionStatus_old";
ALTER TYPE "TransactionStatus_new" RENAME TO "TransactionStatus";
DROP TYPE "public"."TransactionStatus_old";
ALTER TABLE "Transaction" ALTER COLUMN "status" SET DEFAULT 'CREATED';
COMMIT;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "escrowHeld",
DROP COLUMN "platformCommission",
DROP COLUMN "platformRevenue",
DROP COLUMN "totalAmount",
DROP COLUMN "travelerPayout",
ADD COLUMN     "amount" DOUBLE PRECISION NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'CREATED',
ALTER COLUMN "paymentStatus" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_transactionId_key" ON "Dispute"("transactionId");

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
