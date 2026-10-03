/**
 * Server Entry Point
 * Initializes environment variables, connects to database, handles uncaught process errors,
 * and starts the HTTP server listener.
 */

import 'dotenv/config';
import app from './app.js';
import connectDB from './config/db.js';
import logger from './utils/logger.js';

// Catch synchronous uncaught errors to prevent unstable server state
process.on('uncaughtException', (err) => {
  logger.error('CRITICAL: Uncaught Exception detected!', err);
  process.exit(1);
});

// Catch unhandled Promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error('CRITICAL: Unhandled Rejection detected!', reason);
  process.exit(1);
});

// Connect to MongoDB database
connectDB();

// Ensure required security environment variables exist before startup
if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
  throw new Error("Missing JWT environment variables");
}

const PORT = process.env.PORT;

app.listen(PORT, () => {
  logger.info(`🚀 Server proudly serving requests on port ${PORT}`);
});