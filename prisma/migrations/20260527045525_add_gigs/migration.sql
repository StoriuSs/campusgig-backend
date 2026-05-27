-- CreateTable
CREATE TABLE "Gig" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceVnd" INTEGER NOT NULL,
    "deliveryDays" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "rejectionCategory" TEXT,
    "rejectionReason" TEXT,
    "coverImageId" TEXT,
    "submittedAt" TIMESTAMPTZ(6),
    "approvedAt" TIMESTAMPTZ(6),
    "pausedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedBy" TEXT,

    CONSTRAINT "Gig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GigImage" (
    "id" TEXT NOT NULL,
    "gigId" TEXT,
    "imageKey" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GigImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GigBullet" (
    "id" TEXT NOT NULL,
    "gigId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "GigBullet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GigFaq" (
    "id" TEXT NOT NULL,
    "gigId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "GigFaq_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Gig_sellerId_idx" ON "Gig"("sellerId");

-- CreateIndex
CREATE INDEX "Gig_sellerId_status_idx" ON "Gig"("sellerId", "status");

-- CreateIndex
CREATE INDEX "Gig_status_idx" ON "Gig"("status");

-- CreateIndex
CREATE INDEX "Gig_categoryId_idx" ON "Gig"("categoryId");

-- CreateIndex
CREATE INDEX "Gig_deletedAt_idx" ON "Gig"("deletedAt");

-- CreateIndex
CREATE INDEX "GigImage_gigId_position_idx" ON "GigImage"("gigId", "position");

-- CreateIndex
CREATE INDEX "GigImage_gigId_idx" ON "GigImage"("gigId");

-- CreateIndex
CREATE INDEX "GigImage_uploaderId_idx" ON "GigImage"("uploaderId");

-- CreateIndex
CREATE INDEX "GigBullet_gigId_position_idx" ON "GigBullet"("gigId", "position");

-- CreateIndex
CREATE INDEX "GigFaq_gigId_position_idx" ON "GigFaq"("gigId", "position");

-- AddForeignKey
ALTER TABLE "GigImage" ADD CONSTRAINT "GigImage_gigId_fkey" FOREIGN KEY ("gigId") REFERENCES "Gig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GigBullet" ADD CONSTRAINT "GigBullet_gigId_fkey" FOREIGN KEY ("gigId") REFERENCES "Gig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GigFaq" ADD CONSTRAINT "GigFaq_gigId_fkey" FOREIGN KEY ("gigId") REFERENCES "Gig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
