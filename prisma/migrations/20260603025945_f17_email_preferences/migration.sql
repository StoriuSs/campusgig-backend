-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailDisputes" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailGigs" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailOrders" BOOLEAN NOT NULL DEFAULT true;
