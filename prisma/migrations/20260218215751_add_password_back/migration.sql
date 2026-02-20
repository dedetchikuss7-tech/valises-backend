-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SENDER', 'TRAVELER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('INITIATED', 'RESERVED', 'PAID', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'AUTHORIZED', 'CAPTURED', 'REFUNDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "platformCommission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "travelerPayout" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "escrowHeld" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platformRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "TransactionStatus" NOT NULL DEFAULT 'INITIATED',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "senderId" TEXT NOT NULL,
    "travelerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
