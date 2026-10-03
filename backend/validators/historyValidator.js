import { param } from 'express-validator';
import { validateRequest } from './requestValidator.js';

// Validation schema for single history item deletion requests (/api/history/:historyId).
const deleteHistoryValidator = [
  param("historyId").trim().notEmpty().withMessage("History ID is required"),
  validateRequest
];

export {
  deleteHistoryValidator
};
