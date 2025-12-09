# MySQL Migration - Conversion Guide

This document explains the pattern for converting the remaining SQLite-based code to MySQL.

## Overview

The LichtBlick codebase was originally designed with synchronous SQLite operations using `better-sqlite3`. The migration to MySQL requires converting all database operations to async/await patterns using `mysql2/promise`.

## What's Already Done ✅

1. **Database Layer** (`server/db/database.js`)
   - Fully converted to MySQL with connection pooling
   - All core methods are now async
   - Helper methods added: `query()`, `queryOne()`, `execute()`

2. **Server Initialization** (`server/index.js`)
   - Converted to async initialization
   - Proper database connection and cleanup

3. **Image Sync** (`server/utils/imageSync.js`)
   - Converted to async operations

4. **Schema** (`server/db/schema.sql`)
   - Fully converted from SQLite to MySQL syntax
   - All `AUTOINCREMENT` → `AUTO_INCREMENT`
   - All `INTEGER` → `INT`
   - All `strftime('%s', 'now')` → `UNIX_TIMESTAMP()`
   - All `BOOLEAN` → `TINYINT(1)`

5. **Configuration**
   - `package.json` updated (mysql2 instead of better-sqlite3)
   - `.env.example` updated with MySQL connection parameters
   - `DEPLOYMENT.md` created with full Plesk instructions

## What Needs Conversion ⚠️

### Files Using `db.db.prepare()` Pattern

These files directly access the SQLite API and need conversion:

1. **server/routes/uploads.js** - Image upload/management routes
2. **server/routes/api.js** - Configuration and game management API
3. **server/sockets/admin.js** - Admin socket handlers
4. **server/sockets/player.js** - Player socket handlers
5. **server/sockets/beamer.js** - Beamer socket handlers

## Conversion Pattern

### SQLite Pattern (Old)
```javascript
// Synchronous SQLite
const stmt = db.db.prepare('SELECT * FROM images WHERE id = ?');
const image = stmt.get(imageId);

const insertStmt = db.db.prepare('INSERT INTO images (filename, url) VALUES (?, ?)');
const result = insertStmt.run(filename, url);
const newId = result.lastInsertRowid;
```

### MySQL Pattern (New)
```javascript
// Asynchronous MySQL
const image = await db.queryOne('SELECT * FROM images WHERE id = ?', [imageId]);

const result = await db.execute('INSERT INTO images (filename, url) VALUES (?, ?)', [filename, url]);
const newId = result.insertId;
```

## Step-by-Step Conversion Guide

### Step 1: Convert Route Handlers to Async

**Before:**
```javascript
router.get('/images', (req, res) => {
  try {
    const stmt = db.db.prepare('SELECT * FROM images');
    const images = stmt.all();
    res.json({ success: true, data: images });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

**After:**
```javascript
router.get('/images', async (req, res) => {
  try {
    const images = await db.query('SELECT * FROM images');
    res.json({ success: true, data: images });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

### Step 2: Convert Socket Handlers to Async

**Before:**
```javascript
socket.on('admin:select_image', (data, callback) => {
  const stmt = db.db.prepare('SELECT * FROM images WHERE id = ?');
  const image = stmt.get(data.imageId);
  callback({ success: true, data: image });
});
```

**After:**
```javascript
socket.on('admin:select_image', async (data, callback) => {
  try {
    const image = await db.queryOne('SELECT * FROM images WHERE id = ?', [data.imageId]);
    callback({ success: true, data: image });
  } catch (error) {
    callback({ success: false, message: error.message });
  }
});
```

### Step 3: Handle Transactions

**Before (SQLite):**
```javascript
const reset = db.db.transaction(() => {
  db.db.prepare('DELETE FROM answers').run();
  db.db.prepare('DELETE FROM players').run();
  db.db.prepare('UPDATE games SET status = ? WHERE id = ?').run('lobby', gameId);
});
reset();
```

**After (MySQL):**
```javascript
const connection = await db.beginTransaction();
try {
  await connection.query('DELETE FROM answers');
  await connection.query('DELETE FROM players');
  await connection.query('UPDATE games SET status = ? WHERE id = ?', ['lobby', gameId]);
  await db.commitTransaction(connection);
} catch (error) {
  await db.rollbackTransaction(connection);
  throw error;
}
```

## Database API Reference

### New Methods Available

#### `db.query(sql, params)`
Execute a SELECT query, returns array of rows.
```javascript
const images = await db.query('SELECT * FROM images WHERE game_id = ?', [gameId]);
```

#### `db.queryOne(sql, params)`
Execute a SELECT query, returns first row or null.
```javascript
const image = await db.queryOne('SELECT * FROM images WHERE id = ?', [imageId]);
```

#### `db.execute(sql, params)`
Execute INSERT/UPDATE/DELETE, returns { insertId, affectedRows, changes }.
```javascript
const result = await db.execute('INSERT INTO images (filename, url) VALUES (?, ?)', [filename, url]);
console.log('New ID:', result.insertId);
```

#### `db.beginTransaction()`, `db.commitTransaction(conn)`, `db.rollbackTransaction(conn)`
Handle transactions:
```javascript
const conn = await db.beginTransaction();
try {
  await conn.query('UPDATE players SET score = score + 100 WHERE id = ?', [playerId]);
  await db.commitTransaction(conn);
} catch (error) {
  await db.rollbackTransaction(conn);
}
```

## SQL Syntax Changes

### DateTime Functions
```javascript
// Before (SQLite)
strftime('%s', 'now')

// After (MySQL)
UNIX_TIMESTAMP()
```

### Auto Increment
```javascript
// Before (SQLite)
INTEGER PRIMARY KEY AUTOINCREMENT

// After (MySQL)
INT PRIMARY KEY AUTO_INCREMENT
```

### Boolean Values
```javascript
// Before (SQLite)
INTEGER DEFAULT 0  -- Used as boolean

// After (MySQL)
TINYINT(1) DEFAULT 0  -- Proper boolean type
```

### Result Object
```javascript
// Before (SQLite)
result.lastInsertRowid
result.changes

// After (MySQL)
result.insertId
result.affectedRows
```

## Testing Strategy

1. **Start MySQL Server**
   ```bash
   # Make sure MySQL/MariaDB is running
   mysql -u root -p
   CREATE DATABASE lichtblick;
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your MySQL credentials
   ```

3. **Install Dependencies**
   ```bash
   cd server
   npm install
   ```

4. **Start Server**
   ```bash
   npm start
   ```

5. **Test Endpoints**
   - Health check: `GET /api/health`
   - Database should auto-initialize on first run

## Common Issues

### Issue: "Access denied for user"
**Solution:** Check DB_USER and DB_PASSWORD in .env

### Issue: "Unknown database 'lichtblick'"
**Solution:** Create the database manually:
```sql
CREATE DATABASE lichtblick CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Issue: "Cannot find module 'mysql2'"
**Solution:** Run `npm install` in the server directory

## Priority Order for Conversion

1. ✅ **Database Layer** - DONE
2. ✅ **Server Init** - DONE
3. ⚠️ **Routes (uploads.js, api.js)** - IN PROGRESS
4. ⚠️ **Socket Handlers (admin.js, player.js, beamer.js)** - PENDING
5. ⚠️ **Integration Tests** - PENDING

## Completion Checklist

- [ ] Convert server/routes/uploads.js to async
- [ ] Convert server/routes/api.js to async
- [ ] Convert server/sockets/admin.js to async
- [ ] Convert server/sockets/player.js to async
- [ ] Convert server/sockets/beamer.js to async
- [ ] Test all endpoints
- [ ] Test socket connections
- [ ] Test game flow end-to-end
- [ ] Document known issues
- [ ] Update README.md

## Notes

- All conversions must add `async` to function signatures
- All `db.db.prepare()` calls must be replaced with `db.query()` / `db.queryOne()` / `db.execute()`
- All database calls must use `await`
- Transaction handling is different - use the new transaction methods
- Error handling should remain consistent

## Support

For questions or issues during conversion:
- See DEPLOYMENT.md for Plesk-specific guidance
- Check GitHub Issues
- Review the MySQL API documentation
