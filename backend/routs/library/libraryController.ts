import { Response, Request } from 'express'
import { PrismaClient, User, Book, Prisma } from '@prisma/client'
import mongoose from 'mongoose'
import axios from 'axios'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'
import { format } from 'date-fns'
import { request } from 'http'

const pyServer = process.env.PY_SERVER_URL || "Test_env_value_pyserver";

interface AuthRequest extends Request {
  user?: User
  file?: Express.Multer.File
}
const prisma = new PrismaClient()

export const addBook = async (req: Request, res: Response) => {
  try {
    console.log(req.body);
    const bookData = {
      title: req.body.title,
      author: req.body.author || "Unknown",
      bookURL: req.body.bookUrl,
      isComplete: req.body.isComplete || false,
      categoryList: req.body.category || [],
      numberOfChapters: req.body.numberOfChapters || 0,
      coverImg: req.body.coverImg || null,
      lastUpdated: req.body.lastUpdated || new Date().toISOString(), // Optional: add field if you want
    };

    if (!bookData.bookURL) {
      res.status(400).json({ message: 'bookURL is required' });
      return;
    }

    console.log('Processing book:', bookData.title);

    // UPSERT: Insert if new, update if exists (by unique bookURL)
    const book = await prisma.book.upsert({
      where: { bookURL: bookData.bookURL },
      update: {
        title: bookData.title,
        author: bookData.author,
        isComplete: bookData.isComplete,
        categoryList: bookData.categoryList,
        numberOfChapters: bookData.numberOfChapters,
        coverImg: bookData.coverImg,
        lastUpdated: bookData.lastUpdated, // If you add this field to schema
      },
      create: bookData,
    });

    res.status(200).json({ message: 'Book added/updated', book });
  } catch (error: any) {
    console.error('Error upserting book:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const getBookPage = async (req: Request, res: Response) => {
  let page = Number(req.query.page) || 1;
  const query = (req.query.q ?? "") as string;
  console.log("Search query:", query)

  // If not a valid positive integer → use page 1
  if (!Number.isInteger(page) || page < 1) {
    page = 1
  }

  let skip = page - 1
  const limit = 20
  skip = skip * limit
  try {
    const books = await prisma.book.findMany({ skip: skip, take: limit, where: { title: { contains: query, mode: 'insensitive' } } })

    const totalBooks = await prisma.book.count()
    const totalPages = Math.ceil(totalBooks / limit)

    if (!books) {
      res.status(404).json({ message: 'No books found' })
      return // Added return to stop execution
    }

    res.json({
      books,
      totalBooks,
      totalPages,
      currentPage: skip,
    })
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const getBookInfo = async (req: Request, res: Response) => {
  try {
    const id = req.params.id
    if (!id) {
      res.status(404).json({ message: 'Book with id not found' })
      return
    }
    const book = await prisma.book.findFirst({
      where: {
        id: id,
      },
    })
    if (!book) {
      res.status(404).json({ message: 'Book not found' })
      return
    }
    res.json(book)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

// export const bookAddChapters = async (req: Request, res: Response) => {
//   // poulkates Chapters to a Book
//   try {
//     if (!req.params.bookId) {
//       res.status(404).json({ message: 'Specification not found' })
//       return
//     }
//     if (!req.body.nr) {
//       res.status(404).json({ message: 'requset Body doe not have chapters nr' })
//       return
//     }

//     const book = await prisma.book.findUnique({
//       where: {
//         id: req.params.bookId,
//       },
//     })
//     if (!book) {
//       res.status(404).json({ message: 'Book not found' })
//       return
//     }

//     const chapters: Chapter[] = []
//     const result = await axios.put(
//       `${pyServer}/get/chapters`,
//       { bookURL: book.bookURL + '#tab-chapters-title' },
//       {
//         responseType: 'json',
//         maxContentLength: Infinity,
//         maxBodyLength: Infinity,
//       }
//     )
//     if (!result.data.ch_list) {
//       res.status(404).json({ message: 'No chapters found' })
//       return
//     }

//     result.data.ch_list.forEach((ch: string[]) => {
//       const newCh: Chapter = {
//         chapterNumber: parseInt(req.body.nr),
//         title: ch[0],
//         chapterURL: ch[1],
//         text: null,
//       }
//       chapters.push(newCh)
//     })

//     const updatedBook = await prisma.book.update({
//       where: {
//         id: req.params.bookId,
//       },
//       data: {
//         chList: chapters,
//       },
//     })
//     res.status(200).json({ chapters: chapters, updatedBook: updatedBook })
//   } catch (error: any) {
//     res.status(500).json({ message: error.message })
//   }
// }

// export const getChapter = async (req: Request, res: Response) => {
//   //!BROKEN FIX CODE
//   try {
//     console.log(req.params)
//     if (!req.params.bookId) {
//       res.status(404).json({ message: 'Book id not provided' })
//       return
//     }
//     if (!req.body.nr || !req.body.bookURL) {
//       res
//         .status(404)
//         .json({ message: 'Book URL or Chapter number not provided' })
//       return
//     }

//     const book = await prisma.book.findUnique({
//       where: { id: req.params.bookId },
//     })

//     if (!book) {
//       res.status(404).json({ message: 'Book not found' })
//       return
//     }
//     const chapterNumber = parseInt(req.params.chapterNumber)

//     const chapter: Chapter | undefined = book.chList.find(
//       (c) => c?.chapterNumber === chapterNumber
//     )

//     if (!chapter) {
//       res.status(404).json({ message: 'Chapter not found' })
//       return
//     }

//     res.json(chapter)
//   } catch (error: any) {
//     console.error('Error getting chapter:', error) // Log the error
//     res.status(500).json({ message: error.message })
//   }
// }


export const getStreamKey = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(404).json({ message: 'User is not authorized' })
      return
    }
    const token = generateToken(req.user.id)
    res.json({ token: token })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

export const verifYStreamKey = (req: Request, res: Response) => {
  try {
    const { streamKey, userId } = req.body
    const decoded: any = jwt.verify(streamKey, process.env.JWT_SECRET!)
    console.log(streamKey, userId, decoded, req.body)
    if (!decoded?.id) {
      res.status(404).json({ valid: false, error: 'Invalid token' })
    }
    if (decoded.id === userId) {
      res.status(200).json({ valid: true })
    } else {
      res.status(401).json({ valid: false, error: 'User ID mismatch' })
    }
  } catch (err) {
    res.status(401).json({ valid: false, error: err })
  }
}

const generateToken = (id: any) => {
  return jwt.sign({ id }, process.env.JWT_SECRET!, { expiresIn: '30d' })
}

