/**
 * Winston Logging Module
 * Configures application loggers with file rotation (5MB max size per log file, max 5 files)
 * for `error.log` and `combined.log`, along with formatted console logging in development mode.
 */

import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.splat()
  ),
  defaultMeta: { service: "swift-api" },
  transports: [
    new winston.transports.File({ 
      filename: path.join(__dirname, "../logs/error.log"), 
      level: "error",
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.json()
      )
    }),
    new winston.transports.File({ 
      filename: path.join(__dirname, "../logs/combined.log"),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.json()
      )
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, stack }) => {
          if (stack) {
            return `[${timestamp}] ${level}: ${message}\n${stack}`;
          }
          return `[${timestamp}] ${level}: ${message}`;
        })
      ),
    })
  );
}

export default logger;
