-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('Failed', 'Pending', 'Success');

-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('Dice', 'LOTTERY', 'BlindBox', 'Roulette', 'CoinFlip', 'BlackJack', 'SpaceInvader');

-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('ONGOING', 'FINISHED', 'NOT_STARTED');

-- CreateEnum
CREATE TYPE "SportbetOutcome" AS ENUM ('WIN', 'LOSE', 'CANCELLED', 'NOT_DECIDED');

-- CreateEnum
CREATE TYPE "PlacebetOutcome" AS ENUM ('home', 'away', 'draw');

-- CreateEnum
CREATE TYPE "SportType" AS ENUM ('NFL', 'FOOTBALL');

-- CreateTable
CREATE TABLE "Tournament" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "totalStakes" INTEGER NOT NULL DEFAULT 0,
    "uniqueUsers" INTEGER NOT NULL DEFAULT 0,
    "paused" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "address" TEXT NOT NULL,
    "username" TEXT,
    "avatar" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SportTournament" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "totalStakes" INTEGER NOT NULL DEFAULT 0,
    "uniqueUsers" INTEGER NOT NULL DEFAULT 0,
    "paused" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SportTournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stat" (
    "id" UUID NOT NULL,
    "tickets" INTEGER NOT NULL DEFAULT 0,
    "total_wins" INTEGER NOT NULL DEFAULT 0,
    "total_losses" INTEGER NOT NULL DEFAULT 0,
    "total_points" DOUBLE PRECISION NOT NULL DEFAULT 0.00,
    "total_sport_wins" INTEGER NOT NULL DEFAULT 0,
    "total_sport_losses" INTEGER NOT NULL DEFAULT 0,
    "total_sport_points" DOUBLE PRECISION NOT NULL DEFAULT 0.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "Stat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" UUID NOT NULL,
    "stake" INTEGER NOT NULL,
    "lives" INTEGER,
    "point" DOUBLE PRECISION NOT NULL DEFAULT 0.00,
    "lottery_digits" TEXT,
    "lottery_outcome_digits" TEXT,
    "game_type" "GameType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SportRound" (
    "id" UUID NOT NULL,
    "stake" INTEGER NOT NULL,
    "sport_type" "SportType" NOT NULL,
    "point" DOUBLE PRECISION NOT NULL DEFAULT 0.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "betId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "SportRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dealerId" UUID NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" UUID NOT NULL,
    "hand" JSONB[],
    "score" INTEGER NOT NULL,
    "stand" BOOLEAN NOT NULL,
    "stake" INTEGER,
    "result" TEXT,
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" UUID NOT NULL,
    "gameId" UUID NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dealer" (
    "id" UUID NOT NULL,
    "hand" JSONB[],
    "score" INTEGER NOT NULL,
    "stand" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dealer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "tag" TEXT,
    "txId" TEXT NOT NULL,
    "txStatus" "TxStatus",
    "txSender" TEXT,
    "action" TEXT,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SportBet" (
    "id" UUID NOT NULL,
    "gameId" TEXT,
    "fixureId" TEXT,
    "status" "BetStatus" NOT NULL,
    "sport_type" "SportType" NOT NULL,
    "stake" INTEGER NOT NULL,
    "potentialWin" INTEGER NOT NULL,
    "elapsed" TEXT,
    "placebetOutcome" "PlacebetOutcome" NOT NULL,
    "outcome" "SportbetOutcome" NOT NULL,
    "goals" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "league" JSONB,
    "teams" JSONB,
    "userId" UUID NOT NULL,

    CONSTRAINT "SportBet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotteryDraw" (
    "id" UUID NOT NULL,
    "digits" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LotteryDraw_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_key_key" ON "Tournament"("key");

-- CreateIndex
CREATE INDEX "Tournament_totalStakes_idx" ON "Tournament"("totalStakes");

-- CreateIndex
CREATE INDEX "Tournament_start_end_idx" ON "Tournament"("start", "end");

-- CreateIndex
CREATE UNIQUE INDEX "User_address_key" ON "User"("address");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_createdAt_updatedAt_idx" ON "User"("createdAt", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SportTournament_key_key" ON "SportTournament"("key");

-- CreateIndex
CREATE INDEX "SportTournament_totalStakes_idx" ON "SportTournament"("totalStakes");

-- CreateIndex
CREATE INDEX "SportTournament_start_end_idx" ON "SportTournament"("start", "end");

-- CreateIndex
CREATE UNIQUE INDEX "Stat_userId_key" ON "Stat"("userId");

-- CreateIndex
CREATE INDEX "Stat_tickets_idx" ON "Stat"("tickets");

-- CreateIndex
CREATE INDEX "Stat_createdAt_updatedAt_idx" ON "Stat"("createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Stat_total_sport_points_idx" ON "Stat"("total_sport_points");

-- CreateIndex
CREATE INDEX "Stat_total_points_total_losses_total_wins_idx" ON "Stat"("total_points", "total_losses", "total_wins");

-- CreateIndex
CREATE INDEX "Round_point_idx" ON "Round"("point");

-- CreateIndex
CREATE INDEX "Round_stake_idx" ON "Round"("stake");

-- CreateIndex
CREATE INDEX "Round_game_type_idx" ON "Round"("game_type");

-- CreateIndex
CREATE INDEX "Round_createdAt_updatedAt_idx" ON "Round"("createdAt", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SportRound_betId_key" ON "SportRound"("betId");

-- CreateIndex
CREATE INDEX "SportRound_sport_type_idx" ON "SportRound"("sport_type");

-- CreateIndex
CREATE INDEX "SportRound_point_stake_idx" ON "SportRound"("point", "stake");

-- CreateIndex
CREATE INDEX "SportRound_createdAt_updatedAt_idx" ON "SportRound"("createdAt", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Game_dealerId_key" ON "Game"("dealerId");

-- CreateIndex
CREATE INDEX "Game_createdAt_updatedAt_idx" ON "Game"("createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Player_createdAt_updatedAt_idx" ON "Player"("createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Dealer_createdAt_updatedAt_idx" ON "Dealer"("createdAt", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_txId_key" ON "Transaction"("txId");

-- CreateIndex
CREATE INDEX "Transaction_tag_idx" ON "Transaction"("tag");

-- CreateIndex
CREATE INDEX "Transaction_txSender_idx" ON "Transaction"("txSender");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_updatedAt_idx" ON "Transaction"("createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "SportBet_fixureId_idx" ON "SportBet"("fixureId");

-- CreateIndex
CREATE INDEX "SportBet_gameId_idx" ON "SportBet"("gameId");

-- CreateIndex
CREATE INDEX "SportBet_createdAt_updatedAt_idx" ON "SportBet"("createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "SportBet_status_placebetOutcome_outcome_idx" ON "SportBet"("status", "placebetOutcome", "outcome");

-- CreateIndex
CREATE INDEX "LotteryDraw_createdAt_updatedAt_idx" ON "LotteryDraw"("createdAt", "updatedAt");

-- AddForeignKey
ALTER TABLE "Stat" ADD CONSTRAINT "Stat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SportRound" ADD CONSTRAINT "SportRound_betId_fkey" FOREIGN KEY ("betId") REFERENCES "SportBet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SportRound" ADD CONSTRAINT "SportRound_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SportBet" ADD CONSTRAINT "SportBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
