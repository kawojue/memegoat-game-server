// const fs = require('fs')
// import { v4 as uuidv4 } from 'uuid'
// import { PrismaClient } from '@prisma/client'

// const prisma = new PrismaClient()

// const retryTransaction = async (fn: () => Promise<void>, retries = 5) => {
//     for (let i = 0; i < retries; i++) {
//         try {
//             await fn()
//             break
//         } catch (error) {
//             if (i === retries - 1) {
//                 throw error
//             }
//             await new Promise(resolve => setTimeout(resolve, 100))
//         }
//     }
// }

// const seeder = async () => {
//     try {
//         const tournaments = await prisma.tournament.findMany()
//         const transactions = await prisma.transaction.findMany({ orderBy: { createdAt: 'desc' } })
//         const lotteryDraws = await prisma.lotteryDraw.findMany()
//         const sportTournaments = await prisma.sportTournament.findMany()

//         const users = await prisma.user.findMany({
//             include: {
//                 stat: true,
//                 rounds: {
//                     orderBy: {
//                         createdAt: 'desc',
//                     },
//                 },
//                 sportBets: {
//                     orderBy: { createdAt: 'desc' },
//                     include: {
//                         sportRound: true
//                     }
//                 },
//             },
//             orderBy: { createdAt: 'desc' }
//         })

//         fs.writeFileSync('users.json', JSON.stringify(users, null, 2), 'utf-8')
//         fs.writeFileSync('tournaments.json', JSON.stringify(tournaments, null, 2), 'utf-8')
//         fs.writeFileSync('lotteryDraws.json', JSON.stringify(lotteryDraws, null, 2), 'utf-8')
//         fs.writeFileSync('transactions.json', JSON.stringify(transactions, null, 2), 'utf-8')
//         fs.writeFileSync('sportTournaments.json', JSON.stringify(sportTournaments, null, 2), 'utf-8')
//         console.log('Saved')
//     } catch (error) {
//         console.error('Error fetching users or writing to file:', error)
//     } finally {
//         await prisma.$disconnect()
//     }
// }

// seeder()


// const saveDataFromJson = async () => {
//     try {
//         // Read JSON files
//         const users = JSON.parse(fs.readFileSync('users.json', 'utf-8'))
//         const tournaments = JSON.parse(fs.readFileSync('tournaments.json', 'utf-8'))
//         const lotteryDraws = JSON.parse(fs.readFileSync('lotteryDraws.json', 'utf-8'))
//         const transactions = JSON.parse(fs.readFileSync('transactions.json', 'utf-8'))
//         const sportTournaments = JSON.parse(fs.readFileSync('sportTournaments.json', 'utf-8'))

//         for (const tournament of tournaments) {
//             const { id, ...rest } = tournament
//             await prisma.tournament.create({
//                 data: { ...rest }
//             })
//         }

//         for (const tournament of sportTournaments) {
//             const { id, ...rest } = tournament
//             await prisma.sportTournament.create({
//                 data: { ...rest }
//             })
//         }

//         for (const lotteryDraw of lotteryDraws) {
//             const { id, ...rest } = lotteryDraw
//             await prisma.lotteryDraw.create({
//                 data: { ...rest }
//             })
//         }

//         for (const transaction of transactions) {
//             const { id, ...rest } = transaction
//             await prisma.transaction.create({
//                 data: { ...rest }
//             })
//         }

//         for (const user of users) {
//             const { id, stat, rounds, sportBets, ...rest } = user

//             const createdUser = await prisma.user.create({
//                 data: { ...rest }
//             })

//             if (stat) {
//                 const { id, userId, ...rest } = stat
//                 await prisma.stat.create({
//                     data: {
//                         ...rest,
//                         userId: createdUser.id
//                     }
//                 })
//             }

//             if (rounds && rounds.length > 0) {
//                 for (const round of rounds) {
//                     const { id, userId, ...roundData } = round
//                     await prisma.round.create({
//                         data: {
//                             ...roundData,
//                             userId: createdUser.id
//                         }
//                     })
//                 }
//             }

//             if (sportBets && sportBets.length > 0) {
//                 for (const bet of sportBets) {
//                     const { id, userId, sportRound, ...rest } = bet

//                     const newBet = await prisma.sportBet.create({
//                         data: {
//                             ...rest,
//                             userId: createdUser.id
//                         }
//                     })

//                     const { id: _id, userId: _userId, ...anotherRest } = sportRound

//                     await prisma.sportRound.create({
//                         data: {
//                             ...anotherRest,
//                             betId: newBet.id,
//                             userId: createdUser.id,
//                         }
//                     })
//                 }
//             }
//         }

//         console.log('Data saved with relationships successfully!')
//     } catch (error) {
//         console.error('Error reading or saving data:', error)
//     } finally {
//         await prisma.$disconnect()
//     }
// }

// saveDataFromJson()