import { body, validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';

/**
 * Common middleware function that evaluates express-validator validation chains.
 * Forwards an operational 400 ApiError if validation constraints fail.
 */
export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMsg = errors.array().map((err) => err.msg).join(", ");
    return next(new ApiError(400, `Validation Error: ${errorMsg}`));
  }
  next();
};

// Validation schema for proxy API requests (/api/request).
export const requestProxyValidator = [
  body("url")
    .trim()
    .notEmpty()
    .withMessage("URL is required")
    .custom((val) => {
      try {
        let clean = String(val).trim();
        if (clean.match(/^(GET|POST|PUT|DELETE|PATCH)\s+/i)) {
          clean = clean.replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/i, '');
        }
        const u = new URL(clean);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    })
    .withMessage("Must be a valid URL"),
  body("method").trim().notEmpty().withMessage("Method is required"),
  body("headers").optional(),
  body("params").optional(),
  body("body").optional(),
  validateRequest
];
