-- CreateEnum
CREATE TYPE "CancellationStatus" AS ENUM ('Pending', 'Accepted', 'Rejected', 'Expired');

-- CreateEnum
CREATE TYPE "CancellationInitiator" AS ENUM ('Buyer', 'Seller');

-- CreateEnum
CREATE TYPE "CancellationReasonCode" AS ENUM ('BuyerSituationChanged', 'BuyerOrderedByMistake', 'BuyerAgreedInChat', 'BuyerOther', 'SellerScheduleConflict', 'SellerRequirementsMismatch', 'SellerAgreedInChat', 'SellerOther');

-- CreateEnum
CREATE TYPE "ExtensionStatus" AS ENUM ('Pending', 'Accepted', 'Rejected', 'Expired');

-- CreateEnum
CREATE TYPE "OrderEventType" AS ENUM ('Placed', 'Accepted', 'Declined', 'AutoCancelled', 'Late', 'Delivered', 'DeliveryUpdated', 'ExtensionRequested', 'ExtensionAccepted', 'ExtensionRejected', 'ExtensionExpired', 'CancellationRequested', 'CancellationAccepted', 'CancellationRejected', 'CancellationExpired', 'AcceptDelivery', 'AutoCompleted', 'Finalized');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PendingReview', 'InProgress', 'Late', 'Delivered', 'AwaitingFinalization', 'Completed', 'Cancelled', 'Frozen');

-- CreateTable
CREATE TABLE "Cancellation" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "initiator" "CancellationInitiator" NOT NULL,
    "reasonCode" "CancellationReasonCode" NOT NULL,
    "otherText" TEXT,
    "status" "CancellationStatus" NOT NULL DEFAULT 'Pending',
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMPTZ(6),
    "decidedById" TEXT,

    CONSTRAINT "Cancellation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "deliveredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryFile" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mime" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Extension" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "daysRequested" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "ExtensionStatus" NOT NULL DEFAULT 'Pending',
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMPTZ(6),
    "decidedById" TEXT,

    CONSTRAINT "Extension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "OrderEventType" NOT NULL,
    "actorUserId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "gigId" TEXT NOT NULL,
    "gigTitleSnapshot" TEXT NOT NULL,
    "gigPriceVndSnapshot" INTEGER NOT NULL,
    "gigDeliveryDays" INTEGER NOT NULL,
    "gigCoverKey" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PendingReview',
    "placedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMPTZ(6),
    "deliveredAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "autoCompletedAt" TIMESTAMPTZ(6),
    "acceptDeadline" TIMESTAMPTZ(6),
    "deliveryDeadline" TIMESTAMPTZ(6),
    "reviewDeadline" TIMESTAMPTZ(6),
    "disputeDeadline" TIMESTAMPTZ(6),
    "cancelledByUserId" TEXT,
    "cancellationReason" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cancellation_orderId_status_idx" ON "Cancellation"("orderId", "status");

-- CreateIndex
CREATE INDEX "Delivery_orderId_version_idx" ON "Delivery"("orderId", "version" DESC);

-- CreateIndex
CREATE INDEX "DeliveryFile_deliveryId_idx" ON "DeliveryFile"("deliveryId");

-- CreateIndex
CREATE INDEX "Extension_orderId_status_idx" ON "Extension"("orderId", "status");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE INDEX "Order_buyerId_status_placedAt_idx" ON "Order"("buyerId", "status", "placedAt" DESC);

-- CreateIndex
CREATE INDEX "Order_sellerId_status_placedAt_idx" ON "Order"("sellerId", "status", "placedAt" DESC);

-- CreateIndex
CREATE INDEX "Order_status_acceptDeadline_idx" ON "Order"("status", "acceptDeadline");

-- CreateIndex
CREATE INDEX "Order_status_deliveryDeadline_idx" ON "Order"("status", "deliveryDeadline");

-- CreateIndex
CREATE INDEX "Order_status_reviewDeadline_idx" ON "Order"("status", "reviewDeadline");

-- CreateIndex
CREATE INDEX "Order_status_disputeDeadline_idx" ON "Order"("status", "disputeDeadline");

-- AddForeignKey
ALTER TABLE "Cancellation" ADD CONSTRAINT "Cancellation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryFile" ADD CONSTRAINT "DeliveryFile_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Extension" ADD CONSTRAINT "Extension_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_gigId_fkey" FOREIGN KEY ("gigId") REFERENCES "Gig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
