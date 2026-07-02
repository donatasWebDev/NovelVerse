import express from 'express'
import 'music-metadata'
import { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import { createServer } from 'node:http'
import dotenv from 'dotenv'
import { initSessionMiddleware } from './middleware/session'
import { getRedisClient } from './utils/redisClient'
import userRouter from './routs/user/userRouts'
import libraryRouter from './routs/library/libraryRouts'
import streamRouter from './routs/stream/streamRoute'

declare module 'express' {
  interface Request {
    redis?: Awaited<ReturnType<typeof getRedisClient>>
  }
}

dotenv.config()

const app = express()
const server = createServer(app)
const PORT = process.env.BACKEND_PORT || 5000

const allowedOrigins = [
  'https://novelverse.cv',
  'https://www.novelverse.cv',
  'https://novel-verse-three.vercel.app',
  'http://localhost:5173',
]

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 204,
  }),
)

app.options('*', cors())
app.use(express.json({ limit: '100mb' }))
app.use(express.urlencoded({ limit: '100mb', extended: true }))

async function bootstrap() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not defined in .env file')
    process.exit(1)
  }

  mongoose.set('strictQuery', false)
  try {
    await mongoose.connect(url)
    console.log('Connected to mongoose')
  } catch (err) {
    console.error('Unable to connect to MongoDB:', err)
    process.exit(1)
  }

  app.use(await initSessionMiddleware())

  app.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.redis = await getRedisClient()
      next()
    } catch (err) {
      next(err)
    }
  })

  app.get('/health', async (req: Request, res: Response) => {
    const redisStatus = (await req.redis?.ping()) === 'PONG' ? 'connected' : 'disconnected'
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    res.status(200).json({
      status: 'OK',
      redis: redisStatus,
      mongo: mongoStatus,
    })
  })

  app.use('/api/user', userRouter)
  app.use('/api/lib', libraryRouter)
  app.use('/api/stream', streamRouter)

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack)
    res.status(500).send('Something broke!')
  })

  server.listen(PORT, () => {
    console.log(`server running at localhost:${PORT}`)
  })
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})