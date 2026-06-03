-- AlterTable
ALTER TABLE "Gig" ADD COLUMN     "avgRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "completedOrderCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Gig_avgRating_idx" ON "Gig"("avgRating");

-- CreateIndex
CREATE INDEX "Gig_completedOrderCount_idx" ON "Gig"("completedOrderCount");

-- Backfill the new denormalized counters from existing data.
UPDATE "Gig"
SET "avgRating" = CASE WHEN "reviewCount" > 0 THEN "ratingSumHalfStars"::double precision / 2 / "reviewCount" ELSE 0 END;

UPDATE "Gig" g
SET "completedOrderCount" = (
  SELECT count(*) FROM "Order" o WHERE o."gigId" = g."id" AND o."status" = 'Completed'
);
