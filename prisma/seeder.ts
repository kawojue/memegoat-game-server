const fs = require('fs')
import { v4 as uuidv4 } from 'uuid'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const seeder = async () => {

    console.log("Yay!")
}

seeder()
