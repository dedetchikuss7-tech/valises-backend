/*
  Warnings:

  - You are about to drop the column `resolutionNote` on the `Dispute` table. All the data in the column will be lost.
  - You are about to drop the column `resolvedAt` on the `Dispute` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Dispute" DROP COLUMN "resolutionNote",
DROP COLUMN "resolvedAt",
ADD COLUMN     "resolution" TEXT;
