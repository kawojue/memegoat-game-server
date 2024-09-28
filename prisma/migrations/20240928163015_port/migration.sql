/*
  Warnings:
  - Added the required column `endBlock` to the `Tournament` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startBlock` to the `Tournament` table without a default value. This is not possible if the table is not empty.
*/
-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "endBlock" INTEGER NOT NULL,
ADD COLUMN     "startBlock" INTEGER NOT NULL;