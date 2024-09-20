/*
  Warnings:

  - You are about to drop the column `disbursed` on the `SportTournament` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SportBet" ADD COLUMN     "disbursed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sportTournamentId" UUID;

-- AlterTable
ALTER TABLE "SportTournament" DROP COLUMN "disbursed";

-- AddForeignKey
ALTER TABLE "SportBet" ADD CONSTRAINT "SportBet_sportTournamentId_fkey" FOREIGN KEY ("sportTournamentId") REFERENCES "SportTournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;
