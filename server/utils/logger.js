/**
 * Winston Logger Configuration - Enhanced for Production Debugging
 * 
 * Features:
 * - Structured logs for machine parsing
 * - Human-readable console output for development
 * - Separate log files: error.log, combined.log, http.log, socket.log
 * - Request IDs for correlation
 * - Log rotation (5MB, 5 files)
 * - Searchable format: [TIMESTAMP] [LEVEL] [CATEGORY] message {context}
 * 
 * Environment Variables:
 * - LOG_LEVEL: debug|info|warn|error (default: info, dev: debug)
 * - NODE_ENV: production|development
 * 
 * Log Format for grep/search:
 * - Find all errors: grep "ERROR" combined.log
 * - Find socket events: grep "SOCKET" combined.log
 * - Find specific player: grep "playerId\":42" combined.log
 * - Find HTTP 500s: grep "status\":5" http.log
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Ensure log directory exists
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Generate short request ID (8 chars)
function generateRequestId() {
  return crypto.randomBytes(4).toString('hex');
}

// Custom format: structured but grep-friendly
const searchableFormat = winston.format.printf(({ 
  timestamp, 
  level, 
  message, 
  category = 'APP',
  requestId,
  ...meta 
}) => {
  const levelUpper = level.toUpperCase().padEnd(5);
  const categoryUpper = (category || 'APP').toUpperCase().padEnd(8);
  const reqId = requestId ? `[${requestId}]` : '';
  
  // Remove empty meta objects
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  
  return `[${timestamp}] [${levelUpper}] [${categoryUpper}] ${reqId} ${message}${metaStr}`;
});

// Console format (colorized, human-readable)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, category, requestId, ...meta }) => {
    const cat = category ? `[${category}]` : '';
    const reqId = requestId ? `[${requestId}]` : '';
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level} ${cat}${reqId} ${message}${metaStr}`;
  })
);

// File format (searchable plain text)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  searchableFormat
);

// Determine log level
const isDev = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

// Create main logger
const logger = winston.createLogger({
  level: logLevel,
  defaultMeta: {},
  transports: [
    // Error log (errors only)
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Combined log (all levels)
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: fileFormat,
      maxsize: 5242880,
      maxFiles: 5,
      tailable: true
    })
  ]
});

// Console logging (always in dev, errors only in prod)
if (isDev) {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
} else {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'warn'
  }));
}

// ============================================
// Specialized Logging Functions
// ============================================

/**
 * Log HTTP request/response
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {number} duration - Request duration in ms
 */
function logHttp(req, res, duration) {
  const level = res.statusCode >= 500 ? 'error' : 
                res.statusCode >= 400 ? 'warn' : 'info';
  
  logger.log({
    level,
    message: `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`,
    category: 'HTTP',
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    duration,
    ip: req.ip || req.connection?.remoteAddress
  });
}

/**
 * Log Socket.IO event
 * @param {string} direction - 'IN' (received) or 'OUT' (emitted)
 * @param {string} event - Event name
 * @param {Object} data - Event data (will be summarized)
 * @param {Object} socket - Socket instance
 */
function logSocket(direction, event, data = {}, socket = {}) {
  // Summarize data to avoid huge logs
  const summarizedData = summarizeData(data);
  
  const level = event.includes('error') ? 'error' : 'debug';
  
  logger.log({
    level,
    message: `${direction} ${event}`,
    category: 'SOCKET',
    requestId: socket.requestId,
    socketId: socket.id?.substring(0, 8),
    playerId: socket.playerId,
    playerName: socket.playerName,
    data: summarizedData
  });
}

/**
 * Log database operation
 * @param {string} operation - 'SELECT', 'INSERT', 'UPDATE', 'DELETE'
 * @param {string} table - Table name
 * @param {Object} details - Additional details
 */
function logDb(operation, table, details = {}) {
  logger.debug(`${operation} ${table}`, {
    category: 'DB',
    operation,
    table,
    ...details
  });
}

/**
 * Log game event
 * @param {string} action - Action name
 * @param {Object} details - Event details
 */
function logGame(action, details = {}) {
  logger.info(action, {
    category: 'GAME',
    ...details
  });
}

/**
 * Log client-side error (received from frontend)
 * @param {Object} errorData - Error from client
 * @param {string} clientInfo - Client identification
 */
function logClientError(errorData, clientInfo = {}) {
  logger.error(`Client Error: ${errorData.message || 'Unknown'}`, {
    category: 'CLIENT',
    ...errorData,
    ...clientInfo
  });
}

/**
 * Summarize data object for logging (avoid huge payloads)
 * @param {any} data - Data to summarize
 * @param {number} maxLength - Max string length
 * @returns {any} - Summarized data
 */
function summarizeData(data, maxLength = 200) {
  if (data === null || data === undefined) return data;
  
  if (typeof data === 'string') {
    return data.length > maxLength ? data.substring(0, maxLength) + '...' : data;
  }
  
  if (Array.isArray(data)) {
    if (data.length > 5) {
      return `[Array(${data.length})]`;
    }
    return data.map(item => summarizeData(item, maxLength));
  }
  
  if (typeof data === 'object') {
    const summarized = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip sensitive or large fields
      if (['password', 'pin', 'token', 'image', 'base64'].includes(key.toLowerCase())) {
        summarized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.length > maxLength) {
        summarized[key] = value.substring(0, 50) + '...';
      } else if (Array.isArray(value) && value.length > 5) {
        summarized[key] = `[Array(${value.length})]`;
      } else {
        summarized[key] = value;
      }
    }
    return summarized;
  }
  
  return data;
}

// ============================================
// Express Middleware
// ============================================

/**
 * HTTP Request Logging Middleware
 * Adds requestId and logs request/response
 */
function httpLoggerMiddleware() {
  return (req, res, next) => {
    // Generate request ID
    req.requestId = generateRequestId();
    res.setHeader('X-Request-Id', req.requestId);
    
    const startTime = Date.now();
    
    // Log on response finish
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logHttp(req, res, duration);
    });
    
    next();
  };
}

// ============================================
// Socket.IO Middleware
// ============================================

/**
 * Socket.IO Logging Middleware
 * Wraps socket to log all events
 * @param {Object} socket - Socket.IO socket
 */
function socketLoggerMiddleware(socket) {
  // Assign request ID to socket
  socket.requestId = generateRequestId();
  
  // Log incoming events via onAny
  socket.onAny((event, ...args) => {
    // Skip internal/high-frequency events
    if (event === 'admin:spotlight' || event.startsWith('$')) return;
    logSocket('IN', event, args[0], socket);
  });
}

// ============================================
// Exports
// ============================================

// Add specialized methods to logger
logger.http = logHttp;
logger.socket = logSocket;
logger.db = logDb;
logger.game = logGame;
logger.clientError = logClientError;
logger.httpMiddleware = httpLoggerMiddleware;
logger.socketMiddleware = socketLoggerMiddleware;
logger.generateRequestId = generateRequestId;

// Log startup info
logger.info('Logger initialized', {
  category: 'SYSTEM',
  logLevel,
  logDir,
  isDev
});

module.exports = logger;
