-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('AwaitingResponse', 'ReadyForReview', 'Resolved');

-- CreateEnum
CREATE TYPE "DisputeParty" AS ENUM ('Buyer', 'Seller');

-- CreateEnum
CREATE TYPE "DisputeVerdict" AS ENUM ('RefundBuyer', 'CompleteForSeller', 'SplitFunds');

-- CreateEnum
CREATE TYPE "DisputeReasonCode" AS ENUM ('WorkNotAsDescribed', 'SellerNeverDelivered', 'SellerHarassment', 'BuyerOther', 'BuyerOutOfScope', 'BuyerReviewThreat', 'BuyerUnreachable', 'SellerOther');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderEventType" ADD VALUE 'DisputeFiled';
ALTER TYPE "OrderEventType" ADD VALUE 'DisputeResolved';

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "filedByUserId" TEXT NOT NULL,
    "filedByRole" "DisputeParty" NOT NULL,
    "reasonCode" "DisputeReasonCode" NOT NULL,
    "filerStatement" TEXT NOT NULL,
    "respondedAt" TIMESTAMPTZ(6),
    "responderStatement" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'AwaitingResponse',
    "responseDeadline" TIMESTAMPTZ(6) NOT NULL,
    "verdict" "DisputeVerdict",
    "buyerRefundPercent" INTEGER,
    "adminNotes" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMPTZ(6),
    "filedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeEvidence" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "side" "DisputeParty" NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mime" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisputeEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_orderId_key" ON "Dispute"("orderId");

-- CreateIndex
CREATE INDEX "Dispute_status_filedAt_idx" ON "Dispute"("status", "filedAt");

-- CreateIndex
CREATE INDEX "Dispute_filedByRole_idx" ON "Dispute"("filedByRole");

-- CreateIndex
CREATE INDEX "DisputeEvidence_disputeId_idx" ON "DisputeEvidence"("disputeId");

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_filedByUserId_fkey" FOREIGN KEY ("filedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeEvidence" ADD CONSTRAINT "DisputeEvidence_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
