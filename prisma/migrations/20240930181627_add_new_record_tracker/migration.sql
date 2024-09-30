-- AlterTable
ALTER TABLE "Reward" ADD COLUMN     "claimable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "tourId" UUID;

-- CreateTable
CREATE TABLE "TicketRecords" (
    "id" UUID NOT NULL,
    "lastId" TEXT,
    "boughtTickets" INTEGER NOT NULL DEFAULT 0,
    "freeTickets" INTEGER NOT NULL DEFAULT 0,
    "usedTickets" INTEGER NOT NULL DEFAULT 0,
    "rolloverTickets" INTEGER NOT NULL DEFAULT 0,
    "rolloverRatio" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketRecords_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketRecords_createdAt_idx" ON "TicketRecords"("createdAt");

-- CreateIndex
CREATE INDEX "TicketRecords_updatedAt_idx" ON "TicketRecords"("updatedAt");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;
