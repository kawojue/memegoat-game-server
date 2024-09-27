/*
  Warnings:

  - You are about to drop the column `key` on the `SportTournament` table. All the data in the column will be lost.
  - You are about to drop the column `key` on the `Tournament` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[bId]` on the table `SportTournament` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[bId]` on the table `Tournament` will be added. If there are existing duplicate values, this will fail.
  - Made the column `gameTournamentId` on table `Round` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sportTournamentId` on table `SportBet` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Round" DROP CONSTRAINT "Round_gameTournamentId_fkey";

-- DropForeignKey
ALTER TABLE "SportBet" DROP CONSTRAINT "SportBet_sportTournamentId_fkey";

-- DropIndex
DROP INDEX "Dealer_createdAt_updatedAt_idx";

-- DropIndex
DROP INDEX "Game_createdAt_updatedAt_idx";

-- DropIndex
DROP INDEX "LotteryDraw_createdAt_updatedAt_idx";

-- DropIndex
DROP INDEX "Player_createdAt_updatedAt_idx";

-- DropIndex
DROP INDEX "Reward_createdAt_updatedAt_idx";

-- DropIndex
DROP INDEX "Round_createdAt_updatedAt_idx";

-- DropIndex
DROP INDEX "SportBet_createdAt_updatedAt_idx";

-- DropIndex
DROP INDEX "SportBet_status_placebetOutcome_outcome_idx";

-- DropIndex
DROP INDEX "SportRound_createdAt_updatedAt_idx";

-- DropIndex
DROP INDEX "SportTournament_key_key";

-- DropIndex
DROP INDEX "Stat_createdAt_updatedAt_idx";

-- DropIndex
DROP INDEX "Tournament_key_key";

-- DropIndex
DROP INDEX "Transaction_createdAt_updatedAt_idx";

-- DropIndex
DROP INDEX "User_createdAt_updatedAt_idx";

-- AlterTable
ALTER TABLE "Round" ALTER COLUMN "gameTournamentId" SET NOT NULL;

-- AlterTable
ALTER TABLE "SportBet" ALTER COLUMN "sportTournamentId" SET NOT NULL;

-- AlterTable
ALTER TABLE "SportTournament" DROP COLUMN "key",
ADD COLUMN     "bId" SERIAL;

-- AlterTable
ALTER TABLE "Tournament" DROP COLUMN "key",
ADD COLUMN     "bId" SERIAL;

-- CreateIndex
CREATE INDEX "Dealer_createdAt_idx" ON "Dealer"("createdAt");

-- CreateIndex
CREATE INDEX "Dealer_updatedAt_idx" ON "Dealer"("updatedAt");

-- CreateIndex
CREATE INDEX "Game_createdAt_idx" ON "Game"("createdAt");

-- CreateIndex
CREATE INDEX "Game_updatedAt_idx" ON "Game"("updatedAt");

-- CreateIndex
CREATE INDEX "LotteryDraw_createdAt_idx" ON "LotteryDraw"("createdAt");

-- CreateIndex
CREATE INDEX "Player_createdAt_idx" ON "Player"("createdAt");

-- CreateIndex
CREATE INDEX "Player_updatedAt_idx" ON "Player"("updatedAt");

-- CreateIndex
CREATE INDEX "Player_userId_idx" ON "Player"("userId");

-- CreateIndex
CREATE INDEX "Reward_userId_claimed_idx" ON "Reward"("userId", "claimed");

-- CreateIndex
CREATE INDEX "Round_createdAt_idx" ON "Round"("createdAt");

-- CreateIndex
CREATE INDEX "Round_updatedAt_idx" ON "Round"("updatedAt");

-- CreateIndex
CREATE INDEX "Round_gameTournamentId_idx" ON "Round"("gameTournamentId");

-- CreateIndex
CREATE INDEX "SportBet_userId_idx" ON "SportBet"("userId");

-- CreateIndex
CREATE INDEX "SportBet_createdAt_idx" ON "SportBet"("createdAt");

-- CreateIndex
CREATE INDEX "SportBet_updatedAt_idx" ON "SportBet"("updatedAt");

-- CreateIndex
CREATE INDEX "SportBet_status_outcome_idx" ON "SportBet"("status", "outcome");

-- CreateIndex
CREATE INDEX "SportBet_status_outcome_sportTournamentId_idx" ON "SportBet"("status", "outcome", "sportTournamentId");

-- CreateIndex
CREATE INDEX "SportRound_createdAt_idx" ON "SportRound"("createdAt");

-- CreateIndex
CREATE INDEX "SportRound_updatedAt_idx" ON "SportRound"("updatedAt");

-- CreateIndex
CREATE INDEX "SportRound_userId_updatedAt_idx" ON "SportRound"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SportTournament_bId_key" ON "SportTournament"("bId");

-- CreateIndex
CREATE INDEX "Stat_createdAt_idx" ON "Stat"("createdAt");

-- CreateIndex
CREATE INDEX "Stat_updatedAt_idx" ON "Stat"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_bId_key" ON "Tournament"("bId");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "Transaction_updatedAt_idx" ON "Transaction"("updatedAt");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_updatedAt_idx" ON "User"("updatedAt");

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_gameTournamentId_fkey" FOREIGN KEY ("gameTournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SportBet" ADD CONSTRAINT "SportBet_sportTournamentId_fkey" FOREIGN KEY ("sportTournamentId") REFERENCES "SportTournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
