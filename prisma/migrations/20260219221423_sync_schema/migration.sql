/*
  Warnings:

  - The values [COMPLETED] on the enum `TransactionStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `openedAt` on the `Dispute` table. All the data in the column will be lost.
  - You are about to drop the column `resolution` on the `Dispute` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `kycStatus` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.

*/
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

-- DropIndex
DROP INDEX "Dispute_transactionId_key";

-- AlterTable
ALTER TABLE "Dispute" DROP COLUMN "openedAt",
DROP COLUMN "resolution",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "resolved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "createdAt",
DROP COLUMN "kycStatus",
DROP COLUMN "updatedAt",
ALTER COLUMN "role" DROP DEFAULT;

-- DropEnum
DROP TYPE "KycStatus";
