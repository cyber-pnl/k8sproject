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
 * Initialize database and create tables (idempotent)
 */
async function initDatabase() {
  try {
    await pool.query("SELECT 1");
    console.log("[OK] PostgreSQL connected");

    // Courses
    await pool.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        level VARCHAR(20) NOT NULL DEFAULT 'beginner',
        slug VARCHAR(150) UNIQUE NOT NULL,
        tags TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Lessons
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lessons (
        id SERIAL PRIMARY KEY,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        slug VARCHAR(150) NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        s3_key TEXT NOT NULL DEFAULT '',
        duration_minutes INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (course_id, slug)
      );
    `);

    // Enrollments (inscription aux cours)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS enrollments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, course_id)
      );
    `);

    // Lesson progress
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lesson_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, lesson_id)
      );
    `);

    console.log("[OK] Courses/Lessons/Enrollments tables ready");
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