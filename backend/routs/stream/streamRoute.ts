import express, { Router } from 'express';
import { protect } from '../../middleware/authMiddleware';

import {streamController} from './streamController';

const router: Router = express.Router();
router.get('/', protect, streamController)

export default router;

