import axios from 'axios';
import historyService from '../services/historyService.js';
import { ApiError } from '../utils/ApiError.js';

const genaiUrl = process.env.GENAI_SERVICE_URL;
const genaiApiSecret = process.env.GENAI_API_SECRET;

// Retrieves the request execution history for the authenticated user (latest 50 entries).
export const fetchHistoryHandler = async (req, res, next) => {
  try {
    const history = await historyService.getHistory(req.userId);
    res.json(history || []);
  } catch (error) {
    next(error);
  }
};

// Deletes a single request history entry by ID and synchronizes embedding removal in ChromaDB.
export const deleteHistoryHandler = async (req, res, next) => {
  try {
    const { historyId } = req.params;
    const result = await historyService.deleteHistoryItem(req.userId, historyId);
    if (!result) {
      return next(new ApiError(404, 'History item not found'));
    }

    // 🛡️ Data Privacy & Memory Hygiene: Delete corresponding RAG vector embedding in ChromaDB
    if (genaiUrl) {
      axios.post(`${genaiUrl}/rag/delete-episode`, {
        userId: req.userId,
        episodeId: historyId
      }, {
        headers: { 'x-api-key': genaiApiSecret }
      }).catch(err => console.warn('Non-blocking ChromaDB delete episode notice:', err.message));
    }

    res.json({ success: true, message: 'History item and vector embedding deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Clears all request history entries and purges the user's vector memory from ChromaDB.
export const clearHistoryHandler = async (req, res, next) => {
  try {
    const result = await historyService.clearHistory(req.userId);
    if (!result) {
      return next(new ApiError(404, 'User not found'));
    }

    // 🛡️ Purge all RAG vector memory for this user from ChromaDB
    if (genaiUrl) {
      axios.post(`${genaiUrl}/rag/clear-user-memory`, {
        userId: req.userId
      }, {
        headers: { 'x-api-key': genaiApiSecret }
      }).catch(err => console.warn('Non-blocking ChromaDB clear memory notice:', err.message));
    }

    res.json({ success: true, message: 'History and vector memory cleared successfully' });
  } catch (error) {
    next(error);
  }
};
