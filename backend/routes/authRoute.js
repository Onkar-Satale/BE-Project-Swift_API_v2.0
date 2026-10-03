import express from 'express';
import { register, login, refreshToken, logout, deleteAccount } from '../controllers/authController.js';
import { registerValidator, loginValidator } from '../validators/authValidator.js';
import auth from '../middlewares/authMiddleware.js';

/**
 * Authentication Routes (/api)
 * Manages user registration, login, token refresh, logout, and account deletion.
 */
const router = express.Router();

router.post("/register", registerValidator, register);
router.post("/login", loginValidator, login);
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);
router.delete("/delete-account", auth, deleteAccount);

export default router;