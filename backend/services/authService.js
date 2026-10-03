import User from '../models/userModel.js';
import jwt from 'jsonwebtoken';

// Service encapsulating user authentication, password verification, and JWT operations.
class AuthService {
  // Finds user by email including the password field (override select: false).
  async findUserByEmail(email) {
    const lowercasedEmail = email ? email.toLowerCase() : email;
    return await User.findOne({ email: lowercasedEmail }).select("+password");
  }

  // Finds user by ID including the stored refresh token.
  async findUserWithRefreshToken(userId) {
    return await User.findById(userId).select("+refreshToken");
  }

  // Creates a new user record (password is automatically hashed via Mongoose pre-save hook).
  async registerUser(userData) {
    const user = await User.create(userData);
    return user;
  }

  // Verifies plain text password against user's hashed password.
  async verifyPassword(plainPassword, user) {
    return await user.comparePassword(plainPassword);
  }

  // Generates a short-lived JWT access token.
  generateAuthToken(userId) {
    return jwt.sign(
      { userId },
      process.env.JWT_ACCESS_SECRET ,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN }
    );
  }

  // Generates a long-lived JWT refresh token.
  generateRefreshToken(userId) {
    return jwt.sign(
      { userId },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
    );
  }

  // Stores the active refresh token on the user document.
  async storeRefreshToken(userId, token) {
    return await User.findByIdAndUpdate(userId, { refreshToken: token });
  }

  // Removes the refresh token from the user document upon logout.
  async clearRefreshToken(userId) {
    return await User.findByIdAndUpdate(userId, { $unset: { refreshToken: "" } });
  }

  // Removes a user document permanently from the database.
  async deleteUser(userId) {
    return await User.findByIdAndDelete(userId);
  }

  // Decodes and verifies a JWT refresh token signature.
  verifyRefreshToken(token) {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  }
}

export default new AuthService();
