-- CreateEnum
CREATE TYPE "AbandonmentKind" AS ENUM ('TRIP_DRAFT', 'PACKAGE_DRAFT', 'KYC_PENDING', 'PAYMENT_PENDING');

-- CreateEnum
CREATE TYPE "AbandonmentEventStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReminderJobStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('INTERNAL', 'EMAIL');

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRedacted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbandonmentEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AbandonmentKind" NOT NULL,
    "status" "AbandonmentEventStatus" NOT NULL DEFAULT 'ACTIVE',
    "tripId" TEXT,
    "packageId" TEXT,
    "transactionId" TEXT,
    "metadata" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "abandonedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbandonmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderJob" (
    "id" TEXT NOT NULL,
    "abandonmentEventId" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL DEFAULT 'INTERNAL',
    "status" "ReminderJobStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_transactionId_key" ON "Conversation"("transactionId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "AbandonmentEvent_userId_kind_status_idx" ON "AbandonmentEvent"("userId", "kind", "status");

-- CreateIndex
CREATE INDEX "AbandonmentEvent_tripId_idx" ON "AbandonmentEvent"("tripId");

-- CreateIndex
CREATE INDEX "AbandonmentEvent_packageId_idx" ON "AbandonmentEvent"("packageId");

-- CreateIndex
CREATE INDEX "AbandonmentEvent_transactionId_idx" ON "AbandonmentEvent"("transactionId");

-- CreateIndex
CREATE INDEX "AbandonmentEvent_abandonedAt_idx" ON "AbandonmentEvent"("abandonedAt");

-- CreateIndex
CREATE INDEX "ReminderJob_status_scheduledFor_idx" ON "ReminderJob"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "ReminderJob_abandonmentEventId_idx" ON "ReminderJob"("abandonmentEventId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbandonmentEvent" ADD CONSTRAINT "AbandonmentEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbandonmentEvent" ADD CONSTRAINT "AbandonmentEvent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbandonmentEvent" ADD CONSTRAINT "AbandonmentEvent_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbandonmentEvent" ADD CONSTRAINT "AbandonmentEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderJob" ADD CONSTRAINT "ReminderJob_abandonmentEventId_fkey" FOREIGN KEY ("abandonmentEventId") REFERENCES "AbandonmentEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
