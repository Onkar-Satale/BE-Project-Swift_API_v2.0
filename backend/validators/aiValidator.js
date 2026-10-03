import { body } from 'express-validator';
import { validateRequest } from './requestValidator.js';

// Input validation schema for AI Chatbot prompt requests (/api/ai/bot).
const botValidator = [
  body("message").trim().notEmpty().withMessage("Message is required"),
  body("currentApiContext").optional(),
  body("requestHistory").optional().isArray().withMessage("Request history must be an array"),
  body("userId").optional(),
  validateRequest,
];



// Input validation schema for AI failure assistance requests (/api/ai/failure-assist).
const failureAssistValidator = [
  body("url").trim().notEmpty().withMessage("URL is required"),
  body("method").trim().notEmpty().withMessage("Method is required"),
  body("headers").optional(),
  body("params").optional(),
  body("body").optional(),
  body("status").notEmpty().withMessage("Status is required"),
  body("response").optional(),
  body("duration").optional(),
  body("previousAttempts").optional().isArray(),
  validateRequest,
];

// Input validation schema for historical comparison requests (/api/ai/compare).
const compareValidator = [
  body("attemptA").isObject().withMessage("Attempt A object is required"),
  body("attemptB").isObject().withMessage("Attempt B object is required"),
  validateRequest,
];

// Input validation schema for RAG resolution episode indexing (/api/ai/rag/index-episode).
const indexEpisodeValidator = [
  body("url").trim().notEmpty().withMessage("URL is required"),
  body("method").trim().notEmpty().withMessage("Method is required"),
  body("failedStatus").notEmpty().withMessage("Failed status is required"),
  body("errorSnippet").optional(),
  body("rootCauseLayer").optional(),
  body("appliedFix").optional(),
  body("successStatus").optional(),
  body("successDuration").optional(),
  validateRequest,
];

// Input validation schema for RAG episode retrieval (/api/ai/rag/retrieve).
const retrieveEpisodesValidator = [
  body("url").trim().notEmpty().withMessage("URL is required"),
  body("method").trim().notEmpty().withMessage("Method is required"),
  body("status").optional(),
  body("errorText").optional(),
  body("headersKeys").optional().isArray(),
  body("topK").optional().isNumeric(),
  validateRequest,
];

export {
  botValidator,
  failureAssistValidator,
  compareValidator,
  indexEpisodeValidator,
  retrieveEpisodesValidator,
};
