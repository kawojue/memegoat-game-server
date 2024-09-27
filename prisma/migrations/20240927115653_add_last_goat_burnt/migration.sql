-- AlterTable
ALTER TABLE "SportTournament" ALTER COLUMN "bId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Stat" ADD COLUMN     "lastGoatBurntAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Tournament" ALTER COLUMN "bId" DROP NOT NULL;
