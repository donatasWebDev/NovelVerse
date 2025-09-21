import express, { Router } from 'express';
import { protect } from '../../middleware/authMiddleware';
import upload from '../../middleware/uploads'; // Assuming uploads.ts exports default

import {
  addBook,
  removeDupes,
  getBookPage,
  getBookInfo,
  bookAddChapters,
  getChapter,
  getStreamKey,
  verifYStreamKey,
} from './libraryController';

const router: Router = express.Router();

// router.post('/add/book', addBook);
// router.delete("/delete", removeDupes)
router.get('/get/books', getBookPage);
router.get('/get/book/:id', getBookInfo);
router.put('/put/ch/:bookId', bookAddChapters);
router.put('/get/:bookId/', getChapter); //get chapter info and set lastest read book + chapterId
router.get("/get/audio/key", protect, getStreamKey);
router.post("/verify", verifYStreamKey)


export default router;