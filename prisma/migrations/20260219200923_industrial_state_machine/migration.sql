/*
  Warnings:

  - You are about to drop the column `paymentStatus` on the `Transaction` table. All the data in the column will be lost.
  - Added the required column `commission` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `escrowAmount` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "TransactionStatus" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "paymentStatus",
ADD COLUMN     "commission" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "escrowAmount" DOUBLE PRECISION NOT NULL;
