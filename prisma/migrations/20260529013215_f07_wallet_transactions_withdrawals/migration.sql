-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('Deposit', 'Payment', 'Earning', 'Refund', 'Withdrawal');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('Incoming', 'Outgoing');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('Completed', 'Pending', 'Rejected');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('Pending', 'Completed', 'Rejected');

-- CreateEnum
CREATE TYPE "WithdrawalRejectionReason" AS ENUM ('InvalidAccount', 'SuspiciousActivity', 'InsufficientDocumentation', 'PolicyViolation', 'Other');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bankAccountHolder" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "escrowBalance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pendingWithdrawalBalance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "walletBalance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "direction" "TransactionDirection" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'Completed',
    "amountVnd" INTEGER NOT NULL,
    "orderId" TEXT,
    "withdrawalRequestId" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountVnd" INTEGER NOT NULL,
    "bankNameSnapshot" TEXT NOT NULL,
    "bankAccountNumberSnapshot" TEXT NOT NULL,
    "bankAccountHolderSnapshot" TEXT NOT NULL,
    "availableBalanceSnapshot" INTEGER NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'Pending',
    "rejectionReason" "WithdrawalRejectionReason",
    "rejectionNote" TEXT,
    "processedByUserId" TEXT,
    "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(6),

    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_withdrawalRequestId_key" ON "Transaction"("withdrawalRequestId");

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Transaction_userId_type_createdAt_idx" ON "Transaction"("userId", "type", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WithdrawalRequest_status_requestedAt_idx" ON "WithdrawalRequest"("status", "requestedAt" DESC);

-- CreateIndex
CREATE INDEX "WithdrawalRequest_userId_requestedAt_idx" ON "WithdrawalRequest"("userId", "requestedAt" DESC);

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_withdrawalRequestId_fkey" FOREIGN KEY ("withdrawalRequestId") REFERENCES "WithdrawalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_processedByUserId_fkey" FOREIGN KEY ("processedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
