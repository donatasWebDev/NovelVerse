import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { RequestHandler } from 'express';
import { getRedisClient } from '../utils/redisClient';

export const initSessionMiddleware = async (): Promise<RequestHandler> => {
  const redis = await getRedisClient();

  return session({
    store: new RedisStore({
      client: redis,
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
};