-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('GAME', 'SPORT');

-- DropIndex
DROP INDEX "Stat_total_points_total_losses_total_wins_idx";

-- AlterTable
ALTER TABLE "SportTournament" ADD COLUMN     "disbursed" BOOLEAN DEFAULT false,
ADD COLUMN     "numberOfUsersRewarded" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "disbursed" BOOLEAN DEFAULT false,
ADD COLUMN     "numberOfUsersRewarded" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Reward" (
    "id" UUID NOT NULL,
    "earning" DECIMAL(15,2) NOT NULL,
    "points" DOUBLE PRECISION,
    "type" "RewardType" NOT NULL,
    "earned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sportTournamentId" UUID,
    "gameTournamentId" UUID,
    "userId" UUID NOT NULL,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reward_createdAt_updatedAt_idx" ON "Reward"("createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Stat_total_wins_idx" ON "Stat"("total_wins");

-- CreateIndex
CREATE INDEX "Stat_total_points_idx" ON "Stat"("total_points");

-- CreateIndex
CREATE INDEX "Stat_total_losses_idx" ON "Stat"("total_losses");

-- CreateIndex
CREATE INDEX "Stat_total_sport_wins_idx" ON "Stat"("total_sport_wins");

-- CreateIndex
CREATE INDEX "Stat_total_sport_losses_idx" ON "Stat"("total_sport_losses");

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_gameTournamentId_fkey" FOREIGN KEY ("gameTournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_sportTournamentId_fkey" FOREIGN KEY ("sportTournamentId") REFERENCES "SportTournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
