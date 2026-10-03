import authService from '../services/authService.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Sets HTTP-only refresh token cookie on the response.
 * Uses SameSite=Lax in development and SameSite=None + Secure in production.
 */
const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    path: "/"
  };
};

const setRefreshCookie = (res, token) => {
  res.cookie("refreshToken", token, getCookieOptions());
};

const clearRefreshCookie = (res) => {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("refreshToken", {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    path: "/"
  });
};

// Registers a new user account, creates JWT access & refresh tokens, and attaches refresh cookie.
export const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    const existingUser = await authService.findUserByEmail(email);
    if (existingUser) return next(new ApiError(409, "User already exists with this email address. Please use /api/login or register with a different email."));

    const user = await authService.registerUser({ firstName, lastName, email, password });
    
    const token = authService.generateAuthToken(user._id);
    const refreshToken = authService.generateRefreshToken(user._id);
    await authService.storeRefreshToken(user._id, refreshToken);
    
    setRefreshCookie(res, refreshToken);
    res.status(201).json({
      success: true,
      data: {
        token,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
};

// Authenticates user credentials, generates access & refresh tokens, and returns user metadata.
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await authService.findUserByEmail(email);
    if (!user) return next(new ApiError(401, "Invalid credentials"));

    const isMatch = await authService.verifyPassword(password, user);
    if (!isMatch) return next(new ApiError(401, "Invalid credentials"));

    const token = authService.generateAuthToken(user._id);
    const refreshToken = authService.generateRefreshToken(user._id);
    await authService.storeRefreshToken(user._id, refreshToken);
    
    setRefreshCookie(res, refreshToken);

    res.json({
      success: true,
      data: {
        token,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
};

// Issues a new JWT access token using a valid HTTP-only refresh cookie.
export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) {
      return next(new ApiError(401, "No refresh token available"));
    }
    
    const decoded = authService.verifyRefreshToken(refreshToken);
    const user = await authService.findUserWithRefreshToken(decoded.userId);
    if (!user) {
      return next(new ApiError(401, "User account no longer exists"));
    }
    
    const token = authService.generateAuthToken(user._id);
    const newRefreshToken = authService.generateRefreshToken(user._id);
    await authService.storeRefreshToken(user._id, newRefreshToken);
    setRefreshCookie(res, newRefreshToken);

    res.json({ success: true, token, userId: user._id });
  } catch(err) {
    return next(new ApiError(401, "Refresh token expired or invalid", true, err.stack));
  }
};

// Logs out the user by invalidating the refresh token in the DB and clearing the refresh cookie.
export const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    if (refreshToken) {
      try {
        const decoded = authService.verifyRefreshToken(refreshToken);
        await authService.clearRefreshToken(decoded.userId);
      } catch (e) {
        // Silently swallow expiration errors during logout cleanup
      }
    }
    clearRefreshCookie(res);
    res.json({ success: true, message: "Logged out successfully" });
  } catch(err) {
    next(err);
  }
};

// Permanently deletes the authenticated user's account and clears auth cookie.
export const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.userId;
    await authService.deleteUser(userId);
    clearRefreshCookie(res);
    res.json({ success: true, message: "Account deleted successfully" });
  } catch(err) {
    next(err);
  }
};
