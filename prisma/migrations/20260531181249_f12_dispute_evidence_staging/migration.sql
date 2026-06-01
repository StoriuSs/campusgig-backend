/*
  Warnings:

  - Added the required column `orderId` to the `DisputeEvidence` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DisputeEvidence" ADD COLUMN     "orderId" TEXT NOT NULL,
ALTER COLUMN "disputeId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "DisputeEvidence_orderId_uploadedByUserId_idx" ON "DisputeEvidence"("orderId", "uploadedByUserId");
