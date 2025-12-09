/**
 * LichtBlick v3.0 - Main Server Entry Point
 * 
 * Node.js + Express + Socket.IO + SQLite
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const logger = require('./utils/logger');
const db = require('./db/database');
const crypto = require('crypto');

// Async initialization function
async function initializeServer() {
  // Wait for database to initialize
  // Database is auto-initialized in constructor, but we add a small delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Sync images on startup (now async)
  const { syncImagesWithFilesystem } = require('./utils/imageSync');
  await syncImagesWithFilesystem(db);
  
  // ============================================
  // 🔐 Admin Token - First Run Setup
  // ============================================
  // Generates a unique admin token on first run
  // This token is required in the URL to access admin panel
  // Token is stored in DB and persists until factory reset

  async function initializeAdminToken() {
    let adminToken = await db.getConfig('adminToken');
    
    if (!adminToken) {
      // First run - generate new token
      adminToken = crypto.randomBytes(24).toString('base64url'); // 32 chars, URL-safe
      await db.setConfig('adminToken', adminToken);
      logger.info('═══════════════════════════════════════════════════════════');
      logger.info('🔐 FIRST RUN - Admin Token generiert!');
      logger.info('═══════════════════════════════════════════════════════════');
    }
    
    return adminToken;
  }

  const ADMIN_TOKEN = await initializeAdminToken();

// Initialize Express
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

// Make io available to routes
app.set('io', io);

// Make admin token available to routes and sockets
app.set('adminToken', ADMIN_TOKEN);
io.adminToken = ADMIN_TOKEN;

// Middleware
app.use(logger.httpMiddleware()); // HTTP request logging with request IDs
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (Frontend)
app.use(express.static(path.join(__dirname, '../client')));

// Serve uploads
app.use('/uploads', express.static(path.join(__dirname, '../data/uploads')));

// API Routes
app.use('/api', require('./routes/api'));

// Socket.IO Event Handlers
require('./sockets')(io);

// Client Error Reporting Endpoint
app.post('/api/client-error', (req, res) => {
  const { message, stack, url, userAgent, timestamp } = req.body;
  
  logger.clientError(
    { message, stack, url, timestamp },
    { userAgent, ip: req.ip, requestId: req.requestId }
  );
  
  res.json({ success: true, message: 'Error logged' });
});

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '3.0.0',
    uptime: process.uptime(),
    connections: {
      active: io.engine.clientsCount,
      total: io.engine.clientsCount
    },
    memory: {
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
    }
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// Error Handler
app.use((err, req, res, next) => {
  logger.error('Express Error', { error: err.message, stack: err.stack });
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`🚀 LichtBlick Server started`);
  logger.info(`📡 HTTP Server: http://localhost:${PORT}`);
  logger.info(`🔌 WebSocket Server: ws://localhost:${PORT}`);
  logger.info('');
  logger.info('═══════════════════════════════════════════════════════════');
  logger.info('🔐 ADMIN-ZUGANG (diesen Link nicht teilen!):');
  logger.info(`   http://localhost:${PORT}/admin.html?token=${ADMIN_TOKEN}`);
  logger.info('═══════════════════════════════════════════════════════════');
  logger.info('');
  logger.info(`🎮 Player Join: http://localhost:${PORT}/player.html`);
});

// Graceful Shutdown
const shutdown = (signal) => {
  logger.info(`${signal} received, closing server...`);
  
  // Force exit after 3 seconds if graceful shutdown hangs
  const forceExit = setTimeout(() => {
    logger.warn('Forced shutdown after timeout');
    process.exit(1);
  }, 3000);
  
  // Close Socket.IO first (this is what holds connections open)
  io.close(() => {
    logger.info('Socket.IO closed');
    
    // Then close HTTP server
    server.close(() => {
      logger.info('HTTP server closed');
      clearTimeout(forceExit);
      process.exit(0);
    });
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server, io };
