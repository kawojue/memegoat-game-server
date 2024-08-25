import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const seedTournament = async () => {
    const tournaments = await prisma.tournament.findMany()

    for (const tournament of tournaments) {
        await prisma.tournament.update({
            where: { id: tournament.id },
            data: {
                paused: false,
                stakes: 0,
            },
        })
    }
    await prisma.$disconnect()
}

seedTournament()
