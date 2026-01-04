import { PrismaClient, User, Book, Prisma, LatestRead } from '@prisma/client'
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';

dotenv.config();

interface AuthRequest extends Request {
  user?: User;
  transporter?: any; // Define a more specific type if possible
}

const prisma = new PrismaClient();

const registerUser = async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ message: 'please fill all the fields' });
      return
    }

    const userExists = await prisma.user.findUnique({
      where: { email }
    });

    if (userExists) {
      res.status(400).json({ message: 'User already exists', user: userExists });
      return
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userData: any ={
      name,
      email,
      password: hashedPassword,
      emailVerified: true,
      latestReadId: null
    }
    const user = await prisma.user.create({data: userData});

    if (user) {
      res.status(201).json({
        message: 'new user created',
        _id: user.id,
        name: user.name,
        email: user.email,
        password: hashedPassword,
      });
    } else {
      res.status(400).json({ message: 'wrong user data' });
      return
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique(
      { where: { email } }
    );

    if (!user) {
        res.status(404).json({ message: 'user not found' });
        return
    }

    if (user.email === email) {
      const isPasswordValid = await bcrypt.compare(password, user.password!);
      if (!isPasswordValid) {
        res.status(400).json({ message: 'invalid password' });
        return
      }
      if (!user.emailVerified) {
        res.status(200).json({ message: 'notverified Email not verified' });
        return
      }
       res.status(200).json({
        message: 'login successfully',
        name: user.name,
        _id: user.id,
        email: user.email,
        token: generateToken(user.id),
      });
    }
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(404).json({ message: 'failed to find user' });
      return
    }

    res.status(200).json({
      message: 'login successfully',
      user
      // avatarUrl: user.pic,
    });
  } catch (e: any) {
    console.log(e);
    res.status(500).json({message: e.message})
    return
  }
};

const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany();
    if (!users) {
      res.status(404).json({ message: 'No users found' });
      return
    }
     res.status(200).json({
      users: users.map((user) => ({
        name: user.name,
        _id: user.id,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

const checkEmailTaken = async (req: Request, res: Response) => {
  const given_email = req.body.email;
  const user = await prisma.user.findUnique({
    where: { email: given_email }
  });
  res.status(200).json({ isTaken: !!user });
};

const checkUsernameTaken = async (req: Request, res: Response) => {
  const given_name = req.body.name;
  const user = await prisma.user.findUnique({
    where: { name: given_name }
  });
  res.status(200).json({ isTaken: !!user });
};

const getLatestBook = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        latestRead: true
      }
    })
    if (!user || !user.latestRead || !user.latestRead.bookId) {
      res.status(404).json({ message: 'user latest book not found' });
      return
    }

    console.log(user.latestRead)

    const latestBook = await prisma.latestRead.findUnique({
      where: { id: user.latestRead.id },
      include: {
        book: true
      }
    })
    if (!latestBook) {
      res.status(404).json({ message: 'latest book not found' });
      return
    }
    res.status(200).json({ latestBook: latestBook });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const setLatestBook = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const bookId = req.body.bookId;
    const chapter = req.body.chapter;

    if (!bookId || !chapter) {
      res.status(400).json({ message: 'please provide bookId and chapter' });
      return
    }

    const latestReadData: any = {
      bookId,
      chapterId: chapter,
    }
    const latestBook = await prisma.latestRead.create({data: latestReadData})
    if (!latestBook) {
      res.status(400).json({ message: 'failed to create latest book' });
      return
    }



    const user = await prisma.user.update({
      where: { id: userId },
      data: { latestReadId: latestBook.id},
      include: { latestRead: true }
    });

    if (!user) {
      res.status(404).json({ message: 'user not found' });
      return
    }

    res.status(201).json({ message: 'latest book updated successfully', user });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const generateToken = (id: any) => {
  return jwt.sign({ id }, process.env.JWT_SECRET!, { expiresIn: '30d' });
};

export {
  registerUser,
  login,
  getCurrentUser,
  getAllUsers,
  checkEmailTaken,
  checkUsernameTaken,
  getLatestBook,
  setLatestBook,
};