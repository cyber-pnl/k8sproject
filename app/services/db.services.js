const { Pool } = require("pg");

const pgClient = new Pool({
  host: "postgres",
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});

async function initDB() {
  try {
    await pgClient.query("SELECT 1");
    console.log("PostgreSQL connected");

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password TEXT NOT NULL
      );
    `);

    console.log("Users table ready");
  } catch (err) {
    console.error("PostgreSQL init error:", err);
  }
}

module.exports = { pgClient, initDB };