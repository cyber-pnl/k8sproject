const { Pool } = require("pg");

const pgClient = new Pool({
  host: "postgres",
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});

pgClient.connect()
  .then(() => console.log("PostgreSQL connected"))
  .catch(err => console.error("Postgres error:", err));

module.exports = pgClient;
