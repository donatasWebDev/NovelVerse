import express, { Router } from 'express';
import { protect } from '../../middleware/authMiddleware';
import upload from '../../middleware/uploads'; // Assuming uploads.ts exports default

import {
  addBook,
  getBookPage,
  getBookInfo,
  getStreamKey,
  verifYStreamKey,
} from './libraryController';

const router: Router = express.Router();

router.post('/add/book', addBook);
router.get('/get/books', getBookPage);
router.get('/get/book/:id', getBookInfo);
router.get("/get/audio/key", protect, getStreamKey);
router.post("/verify", verifYStreamKey)


export default router;