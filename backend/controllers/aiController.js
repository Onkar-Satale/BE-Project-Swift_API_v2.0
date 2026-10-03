import axios from 'axios';
import { ApiError } from '../utils/ApiError.js';
import historyService from '../services/historyService.js';

const genaiUrl = process.env.GENAI_SERVICE_URL;
const genaiApiSecret = process.env.GENAI_API_SECRET;

/**
 * Handles Axios communication errors when calling the external GenAI FastAPI service.
 * Converts FastAPI error payloads into operational ApiErrors.
 */
const handleAxiosError = (err, next) => {
  if (err.response) {
    const msg = err.response.data?.detail || err.response.data?.error || 'GenAI Error';
    return next(new ApiError(err.response.status, msg, true, err.stack));
  }
  return next(new ApiError(500, 'Failed to communicate with GenAI service', false, err.stack));
};

// Handles AI chatbot requests by forwarding prompt and API context to the GenAI microservice (V1).
export const botHandler = async (req, res, next) => {
  try {
    const response = await axios.post(`${genaiUrl}/bot`, {
      userId: req.userId || req.body.userId,
      message: req.body.message,
      currentApiContext: req.body.currentApiContext,
      requestHistory: req.body.requestHistory || []
    }, {
      headers: { 'x-api-key': genaiApiSecret }
    });

    res.json(response.data);
  } catch (err) {
    handleAxiosError(err, next);
  }
};



// Handles automated failure diagnosis, root cause prediction, and auto-fix recommendations (V2 + RAG).
export const failureAssistHandler = async (req, res, next) => {
  try {
    const response = await axios.post(`${genaiUrl}/failure-assist`, {
      userId: req.userId || req.body.userId || "guest",
      ...req.body
    }, {
      headers: { 'x-api-key': genaiApiSecret }
    });

    res.json(response.data);
  } catch (err) {
    handleAxiosError(err, next);
  }
};

// Handles side-by-side comparison between two execution history capsules (V2).
export const compareHandler = async (req, res, next) => {
  try {
    const response = await axios.post(`${genaiUrl}/compare`, req.body, {
      headers: { 'x-api-key': genaiApiSecret }
    });

    res.json(response.data);
  } catch (err) {
    handleAxiosError(err, next);
  }
};

// Indexes a verified resolution episode (Failure -> Diagnosis -> Fix -> Success) into RAG Memory
export const indexEpisodeHandler = async (req, res, next) => {
  try {
    const userId = req.userId || req.body.userId || "guest";
    const episodeData = {
      userId,
      ...req.body
    };

    // 1. Save in GenAI RAG vector memory
    const genaiRes = await axios.post(`${genaiUrl}/rag/index-episode`, episodeData, {
      headers: { 'x-api-key': genaiApiSecret }
    });

    // 2. Persist in MongoDB User collection if user is authenticated
    if (req.userId) {
      await historyService.pushResolutionEpisode(req.userId, episodeData);
    }

    res.json({
      success: true,
      indexedEpisode: genaiRes.data?.indexedEpisode || episodeData
    });
  } catch (err) {
    handleAxiosError(err, next);
  }
};

// Retrieves top-k relevant resolution episodes via RAG
export const retrieveEpisodesHandler = async (req, res, next) => {
  try {
    const response = await axios.post(`${genaiUrl}/rag/retrieve`, {
      userId: req.userId || req.body.userId || "guest",
      ...req.body
    }, {
      headers: { 'x-api-key': genaiApiSecret }
    });

    res.json(response.data);
  } catch (err) {
    handleAxiosError(err, next);
  }
};