-- AlterTable
ALTER TABLE "Round" ADD COLUMN     "gameTournamentId" UUID;

-- AlterTable
ALTER TABLE "Stat" ADD COLUMN     "xp" DOUBLE PRECISION DEFAULT 0;

-- CreateIndex
CREATE INDEX "Stat_xp_idx" ON "Stat"("xp");

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_gameTournamentId_fkey" FOREIGN KEY ("gameTournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;
