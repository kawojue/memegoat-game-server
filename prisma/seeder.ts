import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const seedTournament = async () => {
    await prisma.tournament.deleteMany()

    await prisma.round.deleteMany()


    await prisma.$disconnect()
}

seedTournament()