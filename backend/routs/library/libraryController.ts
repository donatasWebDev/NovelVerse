import { Response, Request } from 'express'
import { PrismaClient, User, Book, Prisma } from '@prisma/client'
import mongoose from 'mongoose'
import axios from 'axios'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'
import { format } from 'date-fns'
import { request } from 'http'
import { title } from 'process'

const pyServer = process.env.PY_SERVER_URL || 'Test_env_value_pyserver'

interface AuthRequest extends Request {
  user?: User
  file?: Express.Multer.File
}

const prisma = new PrismaClient()

function escapeForContains(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape regex specials
}

export const addBook = async (req: Request, res: Response) => {
  try {
    const bookData = req.body // expect array of objects

    if (!bookData) {
      return res.status(400).json({ message: 'Expected array of books' })
    }

    const formattedBook = {
      title: bookData.title?.trim() || 'Untitled',
      titleNormalize: escapeForContains(title),
      author: bookData.author?.trim() || 'Unknown',
      bookURL: bookData.bookUrl.trim(),
      isComplete: !!bookData.isComplete,
      categoryList: bookData.category || [],
      numberOfChapters: Number(bookData.numberOfChapters) || 0,
      coverImg:
        bookData.coverImg?.trim() ||
        'https://via.placeholder.com/300x450?text=No+Cover',
      lastUpdated: bookData.lastUpdated || new Date().toISOString(),
    }

    const book = await prisma.book.upsert({
      where: { bookURL: formattedBook.bookURL },
      update: { ...formattedBook },
      create: formattedBook,
    })

    res.status(200).json({
      message: `Processed ${book.title}`
    })
  } catch (error: any) {
    console.error(error)
    res.status(500).json({ message: error.message })
  }
}

export const addBooksBulk = async (req: Request, res: Response) => {
  try {
    const booksInput = req.body

    if (!Array.isArray(booksInput) || booksInput.length === 0) {
      return res
        .status(400)
        .json({ message: 'Request body must be a non-empty array of books' })
    }

    const books: any[] = []
    let skipped = 0

    for (const raw of booksInput) {
      try {
        const bookData = {
          title: raw.title?.trim() || 'Untitled',
          titleNormalize: escapeForContains(title),
          author: raw.author?.trim() || 'Unknown',
          bookURL: raw.bookUrl?.trim() || raw.bookURL?.trim(),
          isComplete: !!raw.isComplete,
          categoryList: Array.isArray(raw.category) ? raw.category : [],
          numberOfChapters: Number(raw.numberOfChapters) || 0,
          coverImg:
            raw.coverImg?.trim() ||
            'https://via.placeholder.com/300x450?text=No+Cover',
          lastUpdated: raw.lastUpdated ? new Date(raw.lastUpdated) : null,
        }

        if (!bookData.bookURL) {
          skipped++
          continue
        }

        books.push(bookData)
      } catch (err: any) {
        skipped++
        console.warn(
          `Skipped book: ${raw.title || 'no title'} - ${err.message}`,
        )
      }
    }

    try {
      const result = await prisma.book.createMany({
        data: books,
      })
      res.status(200).json({
        message: `Processed ${booksInput.length} books`,
        inserted: result.count,
        skipped: booksInput.length - result.count - skipped,
        invalid: skipped,
      })
    } catch (error) {
      throw error
    }
  } catch (error: any) {
    console.error('Bulk import error:', error)
    res
      .status(500)
      .json({ message: 'Bulk import failed', error: error.message })
  }
}

export const getBookPage = async (req: Request, res: Response) => {
  let page = Number(req.query.page) || 1
  const query = (req.query.q ?? '') as string
  console.log('Search query:', query)

  // If not a valid positive integer → use page 1
  if (!Number.isInteger(page) || page < 1) {
    page = 1
  }

  let skip = page - 1
  const limit = 20
  skip = skip * limit
  const safeQuery = escapeForContains(query)
  try {
    const books = await prisma.book.findMany({
      skip: skip,
      take: limit,
      where: { titleNormalize: { contains: safeQuery, mode: 'insensitive' } },
    })

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
    const idParam = req.params.id

    const id = Array.isArray(idParam) ? idParam[0] : idParam

    if (!id) {
      res.status(400).json({ message: 'Book ID is required' })
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

export const toggleFavoriteBook = async (req: AuthRequest, res: Response) => {
  try {
    const { bookId } = req.body
    if (!req.user?.id) {
      res.status(401).json({ message: 'User is not authorized' })
      return
    }
    if (!bookId) {
      res.status(404).json({ message: 'Missing Parameter BookId' })
      return
    }
    const existing = await prisma.favoriteBooks.count({
      where: {
        userId: req.user.id,
        bookId,
      },
    })

    if (existing > 0) {
      await prisma.favoriteBooks.delete({
        where: {
          userId_bookId: {
            userId: req.user.id,
            bookId,
          },
        },
      })
      res.status(201).json({ message: 'favorite books updated deleted old' })
      return
    }
    const newFavorite = await prisma.favoriteBooks.create({
      data: {
        userId: req.user.id,
        bookId: bookId,
      },
    })
    res.status(201).json({
      message: 'favorite books updated added new',
      book: { newFavorite },
    })
    return
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

export const getFavoriteBooks = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findFirst({
      where: {
        id: req.user!.id,
      },
      include: {
        favoriteBooks: {
          include: {
            book: true,
          },
        },
      },
    })
    if (user) {
      res.status(200).json({ favoriteBooks: user.favoriteBooks })
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

export const getStreamKey = async (req: AuthRequest, res: Response) => {
  try {
    const token = generateToken(req.user?.id)
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
