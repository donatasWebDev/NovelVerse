import express from 'express'
import 'music-metadata';
import { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import { createServer } from 'node:http'
import bodyParser from 'body-parser'
import dotenv from 'dotenv'
import { initSessionMiddleware } from './middleware/session'

import {getRedisClient, redisMiddleware} from "./utils/redisClient"

import userRouter from './routs/user/userRouts'
import libraryRouter from './routs/library/libraryRouts'
import streamRouter from './routs/stream/streamRoute'

declare module 'express' {
  interface Request {
    redis?: any;
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
    origin: function (origin, callback) {
      if (!origin) return callback(null, true)
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 204, // for old browsers
  }),
)

// preflight OPTIONS globally (important!)
app.options('*', cors())

app.use(express.json({ limit: '100mb' }))
app.use(express.urlencoded({ limit: '100mb', extended: true }))

server.listen(PORT, () => {
  console.log(`server running at localhost:${PORT}`)
})

const initMiddleware = async () => {
  app.use(await initSessionMiddleware());
}
initMiddleware()


app.use((err: Error,req: Request,res: Response, next: NextFunction) => {
  console.error(err.stack)
  res.status(500).send('Something broke!')
})


app.use(async (req: Request, res: Response, next: NextFunction) => {
    const redisClient = await getRedisClient();
    req.redis = redisClient; // attach to request object
    next();
})


const url: string | undefined = process.env.DATABASE_URL

if (!url) {
  console.error('DATABASE_URL is not defined in .env file')
  process.exit(1) // Exit the process
}



mongoose.set('strictQuery', false)
mongoose
  .connect(url)
  .then(() => {
    console.log('Connected to mongoose')
  })
  .catch((err) => {
    console.log('Unable to connect to MongoDB. Error: ' + err)
  })

app.use(bodyParser.json())

app.get('/health', async (req: Request, res: Response) => {
  const redisStatus = await req.redis.ping() ? 'connected' : 'disconnected'
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
