/*
  Warnings:

  - You are about to drop the column `totalStakes` on the `SportTournament` table. All the data in the column will be lost.
  - You are about to drop the column `uniqueUsers` on the `SportTournament` table. All the data in the column will be lost.
  - You are about to drop the column `totalStakes` on the `Tournament` table. All the data in the column will be lost.
  - You are about to drop the column `uniqueUsers` on the `Tournament` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "SportTournament_totalStakes_idx";

-- DropIndex
DROP INDEX "Tournament_totalStakes_idx";

-- AlterTable
ALTER TABLE "SportTournament" DROP COLUMN "totalStakes",
DROP COLUMN "uniqueUsers",
ADD COLUMN     "disbursed" BOOLEAN DEFAULT false;

-- AlterTable
ALTER TABLE "Tournament" DROP COLUMN "totalStakes",
DROP COLUMN "uniqueUsers";
