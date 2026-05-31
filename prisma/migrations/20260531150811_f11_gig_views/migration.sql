-- CreateTable
CREATE TABLE "GigView" (
    "id" TEXT NOT NULL,
    "gigId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GigView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GigView_gigId_createdAt_idx" ON "GigView"("gigId", "createdAt");

-- AddForeignKey
ALTER TABLE "GigView" ADD CONSTRAINT "GigView_gigId_fkey" FOREIGN KEY ("gigId") REFERENCES "Gig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
