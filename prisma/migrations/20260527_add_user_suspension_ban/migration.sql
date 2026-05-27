-- Migration: add_user_suspension_ban
-- Adds suspension and ban fields to User model

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspendedReason" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspendedById" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspendedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedReason" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedById" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "appealRequestedAt" TIMESTAMP(3);
