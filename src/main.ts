import * as express from 'express'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app/app.module'
import * as cookieParser from 'cookie-parser'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

async function bootstrap() {
  const PORT = parseInt(process.env.PORT, 10) || 2005
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://app.memegoat.io',
      `http://localhost:${PORT}`,
      'https://games.memegoat.io',
      'https://test-app.memegoat.io',
      'https://games-server.memegoat.io',
      'https://memegoat-games.vercel.app',
    ],
    credentials: true,
    optionsSuccessStatus: 200,
    methods: 'GET,POST,DELETE,PATCH,PUT,OPTIONS',
  })

  app.use(express.json({ limit: 5 << 20 }))
  app.use(cookieParser())
  app.useGlobalPipes(new ValidationPipe({ transform: true }))

  const swaggerOptions = new DocumentBuilder()
    .setTitle('Memegoat Game')
    .setVersion('1.7.2')
    .addServer('https://games-server.memegoat.io', 'Server')
    .addServer(`http://localhost:${PORT}`, 'Local')
    .addBearerAuth()
    .addCookieAuth()
    .build()

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerOptions)
  SwaggerModule.setup('docs', app, swaggerDocument)

  try {
    await app.listen(PORT)
    console.log(`http://localhost:${PORT}`)
  } catch (err) {
    console.error(err.message)
  }
}
bootstrap()
