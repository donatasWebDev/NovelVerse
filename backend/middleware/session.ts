import session from 'express-session';
import { RedisStore } from 'connect-redis';
import redisClient from '../utils/redisClient'; // your connected client

export const sessionMiddleware = session({
  store: new RedisStore({
    client: redisClient,
    prefix: 'sess:',
  }),
  secret: process.env.SESSION_SECRET || 'default_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
});