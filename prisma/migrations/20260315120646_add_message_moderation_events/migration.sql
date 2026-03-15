-- CreateEnum
CREATE TYPE "MessageModerationEventKind" AS ENUM ('SANITIZED', 'BLOCKED');

-- CreateTable
CREATE TABLE "MessageModerationEvent" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "kind" "MessageModerationEventKind" NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "reasons" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageModerationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageModerationEvent_transactionId_createdAt_idx" ON "MessageModerationEvent"("transactionId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageModerationEvent_conversationId_createdAt_idx" ON "MessageModerationEvent"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageModerationEvent_senderId_createdAt_idx" ON "MessageModerationEvent"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageModerationEvent_kind_code_createdAt_idx" ON "MessageModerationEvent"("kind", "code", "createdAt");

-- AddForeignKey
ALTER TABLE "MessageModerationEvent" ADD CONSTRAINT "MessageModerationEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageModerationEvent" ADD CONSTRAINT "MessageModerationEvent_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageModerationEvent" ADD CONSTRAINT "MessageModerationEvent_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
