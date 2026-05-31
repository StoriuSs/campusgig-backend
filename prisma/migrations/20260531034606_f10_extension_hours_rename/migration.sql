/*
  Warnings:

  - You are about to drop the column `daysRequested` on the `Extension` table. All the data in the column will be lost.
  - Added the required column `hoursRequested` to the `Extension` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Extension" DROP COLUMN "daysRequested",
ADD COLUMN     "hoursRequested" INTEGER NOT NULL;
