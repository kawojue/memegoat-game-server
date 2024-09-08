const fs = require('fs')
import { v4 as uuidv4 } from 'uuid'
import { GameType, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const seeder = async () => {
    const gameTournament = await prisma.tournament.aggregate({
        _sum: { totalStakes: true }
    })

    const sportTournament = await prisma.sportTournament.aggregate({
        _sum: { totalStakes: true }
    })

    const gameRounds = await prisma.round.count()
    const gameRoundsPoints = await prisma.round.aggregate({
        _sum: {
            point: true,
        },
    })

    const sportRounds = await prisma.sportRound.count()
    const sportRoundsPoints = await prisma.sportRound.aggregate({
        _sum: {
            point: true,
        },
    })

    const games = ['Dice', 'BlindBox', 'CoinFlip', 'SpaceInvader', 'LOTTERY', 'SpaceInvader', 'Roulette'] as GameType[]

    const timesPlayedObj: Record<string, { name: string, total: number }> = {}

    for (const game of games) {
        const total = await prisma.round.count({
            where: { game_type: game }
        })

        timesPlayedObj[game] = {
            total,
            name: game === 'BlindBox' ? 'TreasureHunt' : game
        }
    }

    const users = await prisma.user.findMany({
        include: {
            rounds: {
                take: 1
            }
        }
    })

    let USERS_PARTICIPATED = 0

    for (const user of users) {
        if (user.rounds.length !== 0) {
            USERS_PARTICIPATED++
        }
    }

    const sportAnalysis = {
        WIN: {
            name: 'WIN',
            total: await prisma.sportBet.count({
                where: { outcome: 'WIN' }
            })
        },
        LOSE: {
            name: 'LOSE',
            total: await prisma.sportBet.count({
                where: { outcome: 'LOSE' }
            })
        },
        NOT_DECIDED: {
            name: 'NOT_DECIDED',
            total: await prisma.sportBet.count({
                where: { outcome: 'NOT_DECIDED' }
            })
        },
    }

    console.table({
        SPORT_TOURNAMENTS_STAKES: sportTournament._sum.totalStakes,
        GAME_TOURNAMENTS_STAKES: gameTournament._sum.totalStakes,
        GAMES_PLAYED: gameRounds,
        SPORT_BETS: sportRounds,
        SPORT_BETS_POINTS: sportRoundsPoints._sum.point,
        GAME_POINTS: Number(gameRoundsPoints._sum.point.toFixed(2)),
        TOTAL_USERS_OR_UNIQUE_ADDRESSES: users.length,
        USERS_PARTICIPATED,
    })

    console.table({ ...timesPlayedObj })
    console.table({ ...sportAnalysis })

    console.log("\n\nYay!")

    await prisma.$disconnect()
}

seeder()
