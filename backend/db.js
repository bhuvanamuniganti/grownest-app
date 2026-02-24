const Database = require("better-sqlite3");

const db = new Database("database.db");

// Create users table
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT,
    email TEXT,
    password TEXT,
    points INTEGER DEFAULT 0,
    streak_count INTEGER DEFAULT 0
  )
`).run();

// Create uploads table
db.prepare(`
  CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    filename TEXT,
    title TEXT,
    category TEXT,
    description TEXT,
    quality TEXT,
    created_at TEXT,
    claimed_by INTEGER DEFAULT NULL
  )
`).run();

module.exports = db;