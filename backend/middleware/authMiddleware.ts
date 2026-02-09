import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import {getRedisClient} from '../utils/redisClient';

interface AuthRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
  };
}

const prisma = new PrismaClient();

// Cache key prefix + TTL (15 minutes)
const USER_CACHE_PREFIX = 'user:';
const USER_CACHE_TTL = 60 * 15; // 15 minutes

const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token: string | undefined;

  const redis =  await getRedisClient()

  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
      res.status(401).json({ message: 'Unauthorized – no token provided' });
      return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as { id: string };

    const cacheKey = `${USER_CACHE_PREFIX}${decoded.id}`;
    const cachedUser = await redis.get(cacheKey);

    let userData: AuthRequest['user'];

    if (cachedUser) {
      userData = JSON.parse(cachedUser);
      console.log(`Cache hit for user ${decoded.id}`);
    } else {

      userData = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, name: true, email: true, emailVerified: true },
      }) as AuthRequest['user'];

      if (!userData) {
         res.status(401).json({ message: 'User not found' });
         return;
      }

      await redis.setEx(cacheKey, USER_CACHE_TTL, JSON.stringify(userData));
      console.log(`Cache miss → stored user ${decoded.id}`);
    }


    req.user = userData;
    next();
  } catch (err: any) {
    console.error('Auth middleware error:', err);
    res.status(401).json({ message: 'Invalid token', error: err.message });
  }
};

export { protect };