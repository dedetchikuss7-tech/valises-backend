-- CreateEnum
CREATE TYPE "PackageContentCategory" AS ENUM ('DOCUMENTS', 'CLOTHING', 'FOOD', 'ELECTRONICS', 'COSMETICS', 'MEDICINE', 'PERSONAL_ITEMS', 'OTHER');

-- CreateEnum
CREATE TYPE "PackageContentComplianceStatus" AS ENUM ('NOT_DECLARED', 'DECLARED_CLEAR', 'DECLARED_SENSITIVE', 'BLOCKED');

-- AlterTable
ALTER TABLE "Package" ADD COLUMN     "containsBattery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "containsDocuments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "containsElectronic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "containsFragileItems" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "containsLiquid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "containsMedicine" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "containsPerishableItems" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "containsProhibitedItems" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "containsValuableItems" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "contentCategory" "PackageContentCategory",
ADD COLUMN     "contentComplianceNotes" TEXT,
ADD COLUMN     "contentComplianceStatus" "PackageContentComplianceStatus" NOT NULL DEFAULT 'NOT_DECLARED',
ADD COLUMN     "contentDeclaredAt" TIMESTAMP(3),
ADD COLUMN     "contentDeclaredById" TEXT,
ADD COLUMN     "contentSummary" TEXT,
ADD COLUMN     "declaredItemCount" INTEGER,
ADD COLUMN     "declaredValueAmount" DECIMAL(12,2),
ADD COLUMN     "declaredValueCurrency" "CurrencyCode",
ADD COLUMN     "prohibitedItemsDeclarationAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "prohibitedItemsDeclarationAcceptedById" TEXT;

-- CreateIndex
CREATE INDEX "Package_contentDeclaredAt_idx" ON "Package"("contentDeclaredAt");

-- CreateIndex
CREATE INDEX "Package_contentDeclaredById_idx" ON "Package"("contentDeclaredById");

-- CreateIndex
CREATE INDEX "Package_contentComplianceStatus_idx" ON "Package"("contentComplianceStatus");

-- CreateIndex
CREATE INDEX "Package_prohibitedItemsDeclarationAcceptedAt_idx" ON "Package"("prohibitedItemsDeclarationAcceptedAt");

-- CreateIndex
CREATE INDEX "Package_prohibitedItemsDeclarationAcceptedById_idx" ON "Package"("prohibitedItemsDeclarationAcceptedById");

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_contentDeclaredById_fkey" FOREIGN KEY ("contentDeclaredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_prohibitedItemsDeclarationAcceptedById_fkey" FOREIGN KEY ("prohibitedItemsDeclarationAcceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
