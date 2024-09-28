/*
  Warnings:

  - You are about to drop the column `endBlock` on the `Tournament` table. All the data in the column will be lost.
  - You are about to drop the column `startBlock` on the `Tournament` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Tournament" DROP COLUMN "endBlock",
DROP COLUMN "startBlock";
