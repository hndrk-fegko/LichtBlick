# LichtBlick v3.0 Server

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env if needed (default values work for development)
```

### 3. Start Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

### 4. Open Browser

- Landing Page: http://localhost:3000
- Admin Panel: http://localhost:3000/admin.html
- Player Join: http://localhost:3000/player.html
- Beamer View: http://localhost:3000/beamer.html
- Health Check: http://localhost:3000/api/health

## 📊 Current Status

**Phase 1.1 ✅ COMPLETE** - Project Setup
- ✅ Directory structure created
- ✅ package.json configured
- ✅ Main server (index.js) implemented
- ✅ Logger (Winston) configured
- ✅ Validation utilities created

**Phase 1.2 ✅ COMPLETE** - Database Setup
- ✅ SQLite schema created (schema.sql)
- ✅ Database manager (database.js) implemented with **sql.js** (no native compilation)
- ✅ Auto-save after write operations
- ✅ Default config inserted

> **Note:** LichtBlick uses **sql.js** instead of better-sqlite3 to enable deployment on Plesk Shared Hosting without native compilation (no node-gyp, C++, Python needed). See [PLESK_DEPLOYMENT.md](../docs/PLESK_DEPLOYMENT.md) for details.

**Phase 1.3 ✅ COMPLETE** - REST API
- ✅ Settings endpoints (GET/PUT/PATCH)
- ✅ PIN management (POST/DELETE/GET/POST verify)
- ✅ Images endpoint (GET)

**Phase 1.4 ✅ COMPLETE** - Socket.IO Bootstrap
- ✅ Socket.IO server initialized
- ✅ Admin event handlers (basic)
- ✅ Beamer event handlers (basic)
- ✅ Player event handlers (basic)
- ✅ Room-based broadcasting

## 🧪 Testing

### Test REST API

```bash
# Health check
curl http://localhost:3000/api/health

# Get settings
curl http://localhost:3000/api/settings

# Set PIN
curl -X POST http://localhost:3000/api/pin \
  -H "Content-Type: application/json" \
  -d '{"pin":"1234"}'
```

### Test WebSocket

Open browser console at http://localhost:3000 and run:

```javascript
const socket = io();

// Admin test
socket.emit('admin:connect');
socket.emit('admin:spotlight', { x: 500, y: 300, radius: 80 });

// Player test
socket.emit('player:join', { name: 'TestPlayer' }, (response) => {
  console.log('Join response:', response);
});
```

## 📁 Project Structure

```
server/
├── index.js                 # Entry point
├── package.json             # Dependencies
├── .env.example             # Environment template
├── db/
│   ├── database.js          # SQLite wrapper
│   └── schema.sql           # Database schema
├── routes/
│   └── api.js               # REST endpoints
├── sockets/
│   ├── index.js             # Socket.IO bootstrap
│   ├── admin.js             # Admin handlers
│   ├── beamer.js            # Beamer handlers
│   └── player.js            # Player handlers
└── utils/
    ├── logger.js            # Winston logger
    └── validation.js        # Input validation

client/
└── index.html               # Landing page (temp)

data/
├── lichtblick.db           # SQLite database (auto-created)
└── uploads/                 # User uploads (auto-created)

logs/
├── combined.log             # All logs (auto-created)
└── error.log                # Error logs (auto-created)
```

## 🔜 Next Steps

**Phase 2:** Integrate Database with Socket Handlers
- Connect player:join to database
- Implement submit_answer with scoring
- Add leaderboard broadcasting

**Phase 3:** Frontend Adapter
- Create socket-adapter.js
- Migrate admin.html to Socket.IO
- Migrate beamer.html to Socket.IO
- Migrate player.html to Socket.IO

**Phase 4:** Testing & Production Ready
- Load testing (150 concurrent users)
- Multi-device testing
- Error handling edge cases
- Performance optimization

## 📚 Documentation

See `/docs` folder for complete documentation:
- [VISION.md](../docs/VISION.md) - Project vision
- [API_CONTRACT.md](../docs/API_CONTRACT.md) - API specification
- [DATABASE_SCHEMA.md](../docs/DATABASE_SCHEMA.md) - Database structure
- [IMPLEMENTATION_ROADMAP.md](../docs/IMPLEMENTATION_ROADMAP.md) - Implementation plan
- [PLESK_DEPLOYMENT.md](../docs/PLESK_DEPLOYMENT.md) - Plesk Shared Hosting deployment guide
- [MIGRATION_SUMMARY.md](../docs/MIGRATION_SUMMARY.md) - sql.js migration technical overview

## ⚠️ Known Limitations (MVP)

- Image upload not yet implemented (will add multer endpoint)
- Scoring logic placeholder (will implement in Phase 2)
- Player reconnect not implemented (will add session recovery)
- No frontend files yet (will migrate in Phase 3)

## 🐛 Troubleshooting

**Server won't start:**
- Check if port 3000 is free: `netstat -ano | findstr :3000`
- Check Node.js version: `node --version` (requires >=20.0.0)
- Check logs: `logs/error.log`

**Database errors:**
- Delete database: `rm ../data/lichtblick.db*`
- Restart server (will recreate with schema.sql)

**WebSocket not connecting:**
- Check browser console for errors
- Check CORS settings in .env
- Check firewall/antivirus

## 📝 License

MIT License - FeG Nahude
