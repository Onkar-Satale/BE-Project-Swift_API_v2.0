import express from 'express';
import { deleteHistoryValidator } from '../validators/historyValidator.js';
import { fetchHistoryHandler, deleteHistoryHandler, clearHistoryHandler } from '../controllers/historyController.js';
import auth from '../middlewares/authMiddleware.js';

/**
 * Request History Management Routes (/api/history)
 * Protected routes allowing users to retrieve, delete individual, or clear all history logs.
 */
const router = express.Router();

router.use(auth);

router.get('/', fetchHistoryHandler);
router.put('/clear', clearHistoryHandler);
router.delete('/:historyId', deleteHistoryValidator, deleteHistoryHandler);

export default router;