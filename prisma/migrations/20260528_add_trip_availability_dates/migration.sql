-- AlterEnum
ALTER TYPE "TripStatus" ADD VALUE 'CLOSED';

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN "arrivalDate" TIMESTAMP(3),
                   ADD COLUMN "departureDate" TIMESTAMP(3);
