import * as express from 'express'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app/app.module'
import * as cookieParser from 'cookie-parser'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

async function bootstrap() {
  const PORT: number = parseInt(process.env.PORT, 10) || 2005
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      `http://localhost:${PORT}`,
      `https://memegoat-game-server.onrender.com`,
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
    .addServer(`https://memegoat-game-server.onrender.com`, 'Server')
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