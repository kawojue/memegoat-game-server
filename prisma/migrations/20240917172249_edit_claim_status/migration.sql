/*
  Warnings:

  - Changed the type of `claimed` on the `Reward` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Claim" AS ENUM ('DEFAULT', 'PENDING', 'SUCCESSFUL');

-- AlterTable
ALTER TABLE "Reward" DROP COLUMN "claimed",
ADD COLUMN     "claimed" "Claim" NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "key" DROP NOT NULL,
ALTER COLUMN "txStatus" SET DEFAULT 'Pending';
