import { body } from 'express-validator';
import { validateRequest } from './requestValidator.js';

/**
 * Validation schema for user registration requests (/api/register).
 * Enforces email syntax and password strength rules (min 8 chars, 1 uppercase, 1 lowercase, 1 number).
 */
const registerValidator = [
  body("firstName").trim().notEmpty().withMessage("First name is required").isLength({ max: 50 }).withMessage("First name must be at most 50 characters long"),
  body("lastName").optional().trim().isLength({ max: 50 }).withMessage("Last name must be at most 50 characters long"),
  body("email").trim().isEmail().withMessage("Invalid email format"),
  body("password")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters long")
    .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter")
    .matches(/[a-z]/).withMessage("Password must contain at least one lowercase letter")
    .matches(/[0-9]/).withMessage("Password must contain at least one number"),
  validateRequest,
];

// Validation schema for user login requests (/api/login).
const loginValidator = [
  body("email").trim().isEmail().withMessage("Invalid email format"),
  body("password").notEmpty().withMessage("Password is required"),
  validateRequest,
];

export {
  registerValidator,
  loginValidator,
  validateRequest
};
