import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Express middleware validating incoming JWT Bearer tokens in the Authorization header.
 * Verifies token signature and checks user existence in the database.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new ApiError(401, "No Bearer token provided"));
    }

    const token = authHeader?.split(" ")[1];

    if (!token) {
      return next(new ApiError(401, "No token found in Bearer string"));
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    if (!decoded || !decoded.userId) {
      return next(new ApiError(401, "Invalid token payload"));
    }

    const userExists = await User.exists({ _id: decoded.userId });
    if (!userExists) {
      return next(new ApiError(401, "User account not found. Please log in again."));
    }

    req.userId = decoded.userId;
    next();
  } catch (err) {
    next(new ApiError(401, "Invalid or expired token", true, err.stack));
  }
};

export default authMiddleware;