/*
  Warnings:

  - You are about to drop the column `earned` on the `Reward` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Reward" DROP COLUMN "earned",
ADD COLUMN     "claimed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totalTournamentPoints" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Stat" ALTER COLUMN "tickets" SET DEFAULT 0,
ALTER COLUMN "tickets" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "userId" UUID;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
