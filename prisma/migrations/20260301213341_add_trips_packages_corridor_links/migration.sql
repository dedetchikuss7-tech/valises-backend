-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FlightTicketStatus" AS ENUM ('NOT_PROVIDED', 'PROVIDED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RESERVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "corridorId" TEXT,
ADD COLUMN     "packageId" TEXT,
ADD COLUMN     "tripId" TEXT;

-- CreateTable
CREATE TABLE "Corridor" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Corridor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "corridorId" TEXT NOT NULL,
    "departAt" TIMESTAMP(3) NOT NULL,
    "capacityKg" DOUBLE PRECISION,
    "status" "TripStatus" NOT NULL DEFAULT 'DRAFT',
    "flightTicketStatus" "FlightTicketStatus" NOT NULL DEFAULT 'NOT_PROVIDED',
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "corridorId" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "description" TEXT,
    "status" "PackageStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Corridor_code_key" ON "Corridor"("code");

-- CreateIndex
CREATE INDEX "Trip_carrierId_idx" ON "Trip"("carrierId");

-- CreateIndex
CREATE INDEX "Trip_corridorId_idx" ON "Trip"("corridorId");

-- CreateIndex
CREATE INDEX "Trip_status_idx" ON "Trip"("status");

-- CreateIndex
CREATE INDEX "Trip_flightTicketStatus_idx" ON "Trip"("flightTicketStatus");

-- CreateIndex
CREATE INDEX "Package_senderId_idx" ON "Package"("senderId");

-- CreateIndex
CREATE INDEX "Package_corridorId_idx" ON "Package"("corridorId");

-- CreateIndex
CREATE INDEX "Package_status_idx" ON "Package"("status");

-- CreateIndex
CREATE INDEX "Transaction_tripId_idx" ON "Transaction"("tripId");

-- CreateIndex
CREATE INDEX "Transaction_packageId_idx" ON "Transaction"("packageId");

-- CreateIndex
CREATE INDEX "Transaction_corridorId_idx" ON "Transaction"("corridorId");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_corridorId_fkey" FOREIGN KEY ("corridorId") REFERENCES "Corridor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_corridorId_fkey" FOREIGN KEY ("corridorId") REFERENCES "Corridor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_corridorId_fkey" FOREIGN KEY ("corridorId") REFERENCES "Corridor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
