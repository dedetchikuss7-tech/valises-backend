-- CreateTable
CREATE TABLE "PackageTripShortlist" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "travelerId" TEXT NOT NULL,
    "priorityRank" INTEGER NOT NULL DEFAULT 100,
    "note" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageTripShortlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackageTripShortlist_packageId_priorityRank_createdAt_idx" ON "PackageTripShortlist"("packageId", "priorityRank", "createdAt");

-- CreateIndex
CREATE INDEX "PackageTripShortlist_senderId_packageId_idx" ON "PackageTripShortlist"("senderId", "packageId");

-- CreateIndex
CREATE INDEX "PackageTripShortlist_travelerId_packageId_idx" ON "PackageTripShortlist"("travelerId", "packageId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageTripShortlist_packageId_tripId_key" ON "PackageTripShortlist"("packageId", "tripId");

-- AddForeignKey
ALTER TABLE "PackageTripShortlist" ADD CONSTRAINT "PackageTripShortlist_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageTripShortlist" ADD CONSTRAINT "PackageTripShortlist_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageTripShortlist" ADD CONSTRAINT "PackageTripShortlist_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageTripShortlist" ADD CONSTRAINT "PackageTripShortlist_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
