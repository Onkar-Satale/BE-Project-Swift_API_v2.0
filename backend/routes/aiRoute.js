import express from 'express';
import {
  botValidator,
  failureAssistValidator,
  compareValidator,
  indexEpisodeValidator,
  retrieveEpisodesValidator
} from '../validators/aiValidator.js';
import {
  botHandler,
  failureAssistHandler,
  compareHandler,
  indexEpisodeHandler,
  retrieveEpisodesHandler
} from '../controllers/aiController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { aiRateLimiter } from '../middlewares/rateLimiterMiddleware.js';

/**
 * AI Service Routes (/api/ai)
 * Requires JWT authentication and applies AI-specific rate limiting.
 */
const router = express.Router();

router.use(authMiddleware);

// AI Chatbot interaction endpoint (V1)
router.post('/bot', aiRateLimiter, botValidator, botHandler);

// Automatic AI Failure Assistant & Auto-Fix recommendation (V2 + RAG)
router.post('/failure-assist', aiRateLimiter, failureAssistValidator, failureAssistHandler);

// Side-by-side history comparison & differential diagnosis (V2)
router.post('/compare', aiRateLimiter, compareValidator, compareHandler);

// RAG Memory Indexing: Record verified resolution episode (V2 RAG)
router.post('/rag/index-episode', aiRateLimiter, indexEpisodeValidator, indexEpisodeHandler);

// RAG Memory Retrieval: Search relevant past resolutions (V2 RAG)
router.post('/rag/retrieve', aiRateLimiter, retrieveEpisodesValidator, retrieveEpisodesHandler);

export default router;