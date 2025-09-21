import express, { Router } from 'express';
import {
  registerUser,
  login,
  getCurrentUser,
  getAllUsers,
  checkEmailTaken,
  checkUsernameTaken,
  setLatestBook,
  getLatestBook,
  // verifyEmail,
  // sendVerifyEmail,
} from './userController';
import { protect } from '../../middleware/authMiddleware';
import { attachTransporter } from '../../middleware/transporter';

const router: Router = express.Router();

router.post('/', attachTransporter, registerUser);
router.post('/login', login);
router.get('/', protect, getCurrentUser);
router.get('/all', getAllUsers);
router.post('/exist/email', checkEmailTaken);
router.post('/exist/username', checkUsernameTaken);
router.put('/books/new/latest', protect, setLatestBook);
router.get('/books/latest', protect, getLatestBook);
// router.get('/verify/:token', verifyEmail);
// router.post('/verify/email', attachTransporter, sendVerifyEmail);

export default router;