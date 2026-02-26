const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "postgres",
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Initialize database and create tables
 */
async function initDatabase() {
  try {
    await pool.query("SELECT 1");
    console.log("[OK] PostgreSQL connected");

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("[OK] Users table ready");
  } catch (err) {
    console.error("[ERROR] PostgreSQL init error:", err);
    throw err;
  }
}

/**
 * Execute a query
 */
async function query(text, params) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  query,
  initDatabase,
};

